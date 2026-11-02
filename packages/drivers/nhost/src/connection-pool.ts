import { resolveHeaders } from 'nexdk'
import type { HeadersResolver } from 'nexdk'

export type SubscriptionEvent = 'data' | 'error' | 'complete' | 'connected' | 'disconnected'

export interface Subscription {
    emit: (event: SubscriptionEvent, data?: unknown) => void
    query: string
    variables: Record<string, unknown>
}

const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 15_000
const REJECTED_CLOSE_CODES = { min: 4400, max: 4499 }

export interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    handlers: Map<string, Subscription>
    ended: Set<string>
    refCount: number
    intentionalClose: boolean
    retryCount: number
    reconnectTimer: ReturnType<typeof setTimeout> | undefined
    readonly key: string
    readonly wsUrl: string
    readonly initHeaders: () => Promise<Record<string, string>>
}

interface GraphQLMessage {
    message?: string
}

const connectionPool = new Map<string, SharedConnection>()

export function _resetConnectionPool(): void {
    connectionPool.clear()
}

export function backoffDelay(retryCount: number): number {
    return Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_MAX_MS)
}

const identityIds = new WeakMap<object, number>()
let nextPoolId = 0

function identityOf(source: object): number {
    let id = identityIds.get(source)
    if (id === undefined) {
        id = ++nextPoolId
        identityIds.set(source, id)
    }
    return id
}

function poolKey(
    wsUrl: string,
    adminSecret: string | undefined,
    headers: HeadersResolver | undefined,
    owner: object,
): string {
    if (adminSecret === undefined || adminSecret === '') return `isolated|${++nextPoolId}`
    return `${wsUrl}|${adminSecret}|${identityOf(headers ?? owner)}`
}

export function getSharedConnection(
    wsUrl: string,
    adminSecret: string | undefined,
    headers: HeadersResolver | undefined,
    owner: object,
): SharedConnection {
    const key = poolKey(wsUrl, adminSecret, headers, owner)
    const existing = connectionPool.get(key)
    if (existing && !existing.intentionalClose
        && (existing.ws.readyState !== WebSocket.CLOSED || existing.reconnectTimer !== undefined)) {
        existing.refCount++
        return existing
    }

    const conn: SharedConnection = {
        ws: undefined as unknown as WebSocket,
        acknowledged: false,
        handlers: new Map(),
        ended: new Set(),
        refCount: 1,
        intentionalClose: false,
        retryCount: 0,
        reconnectTimer: undefined,
        key,
        wsUrl,
        initHeaders: async () => ({
            ...(adminSecret ? { 'x-hasura-admin-secret': adminSecret } : {}),
            ...(await resolveHeaders(headers)),
        }),
    }

    connect(conn)
    connectionPool.set(key, conn)
    return conn
}

function broadcast(conn: SharedConnection, event: SubscriptionEvent, data?: unknown): void {
    for (const subscription of [...conn.handlers.values()]) subscription.emit(event, data)
}

function sendSubscribe(conn: SharedConnection, id: string, subscription: Subscription): void {
    conn.ws.send(JSON.stringify({
        id,
        type: 'subscribe',
        payload: { query: subscription.query, variables: subscription.variables },
    }))
}

function errorPayload(payload: unknown): { message: string; errors: unknown } {
    const list = Array.isArray(payload) ? (payload as GraphQLMessage[]) : []
    const messages = list.map(item => item?.message).filter((text): text is string => typeof text === 'string')
    return { message: messages.length > 0 ? messages.join('; ') : 'Subscription error', errors: payload }
}

function removeFromPool(conn: SharedConnection): void {
    if (connectionPool.get(conn.key) === conn) connectionPool.delete(conn.key)
}

export function addSubscription(conn: SharedConnection, id: string, subscription: Subscription): void {
    conn.handlers.set(id, subscription)
    if (!conn.acknowledged) return
    sendSubscribe(conn, id, subscription)
    subscription.emit('connected')
}

export function removeSubscription(conn: SharedConnection, id: string): void {
    const subscription = conn.handlers.get(id)
    const wasEnded = conn.ended.delete(id)
    if (subscription === undefined && !wasEnded) return
    conn.handlers.delete(id)
    if (subscription !== undefined && conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify({ id, type: 'complete' }))
    conn.refCount--
    if (conn.refCount > 0) return
    conn.intentionalClose = true
    removeFromPool(conn)
    conn.ws.close()
    subscription?.emit('disconnected')
}

function connect(conn: SharedConnection): void {
    conn.acknowledged = false
    conn.ws = new WebSocket(conn.wsUrl, 'graphql-transport-ws')

    conn.ws.onopen = () => {
        void Promise.resolve(conn.initHeaders()).then(headers => {
            const payload: Record<string, unknown> = {}
            if (Object.keys(headers).length > 0) payload.headers = headers
            conn.ws.send(JSON.stringify({ type: 'connection_init', payload }))
        })
    }

    conn.ws.onmessage = event => {
        let msg: { type: string; id?: string; payload?: unknown }
        try {
            msg = JSON.parse(event.data as string)
        } catch {
            return
        }

        if (!msg || typeof msg !== 'object') return

        if (msg.type === 'ping') {
            conn.ws.send(JSON.stringify({ type: 'pong' }))
            return
        }

        if (msg.type === 'connection_ack' && !conn.acknowledged) {
            conn.acknowledged = true
            conn.retryCount = 0
            for (const [id, subscription] of conn.handlers) sendSubscribe(conn, id, subscription)
            broadcast(conn, 'connected')
            return
        }

        if (msg.id === undefined) return
        const subscription = conn.handlers.get(msg.id)
        if (subscription === undefined) return

        if (msg.type === 'next') {
            subscription.emit('data', msg.payload)
        } else if (msg.type === 'error') {
            conn.handlers.delete(msg.id)
            conn.ended.add(msg.id)
            subscription.emit('error', errorPayload(msg.payload))
        } else if (msg.type === 'complete') {
            conn.handlers.delete(msg.id)
            conn.ended.add(msg.id)
            subscription.emit('complete')
        }
    }

    conn.ws.onclose = closeEvent => {
        if (conn.intentionalClose) {
            removeFromPool(conn)
            return
        }
        broadcast(conn, 'disconnected')
        const code = closeEvent?.code
        if (code !== undefined && code >= REJECTED_CLOSE_CODES.min && code <= REJECTED_CLOSE_CODES.max) {
            const reason = closeEvent.reason ? `: ${closeEvent.reason}` : ''
            broadcast(conn, 'error', { message: `WebSocket closed with code ${code}${reason}`, code, reason: closeEvent.reason })
            conn.handlers.clear()
            conn.intentionalClose = true
            removeFromPool(conn)
            return
        }
        if (conn.handlers.size === 0) {
            removeFromPool(conn)
            return
        }
        scheduleReconnect(conn)
    }
}

function scheduleReconnect(conn: SharedConnection): void {
    if (conn.reconnectTimer !== undefined) return
    const delay = backoffDelay(conn.retryCount)
    conn.retryCount++
    conn.reconnectTimer = setTimeout(() => {
        conn.reconnectTimer = undefined
        if (conn.intentionalClose || conn.handlers.size === 0) {
            removeFromPool(conn)
            return
        }
        connect(conn)
    }, delay)
}
