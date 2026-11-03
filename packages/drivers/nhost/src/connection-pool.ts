import { resolveHeaders } from 'nexdk'
import type { HeadersResolver } from 'nexdk'
import { connect, sendSubscribe } from './graphql-ws.ts'

export { backoffDelay } from './graphql-ws.ts'

export type SubscriptionEvent = 'data' | 'error' | 'complete' | 'connected' | 'disconnected'

export interface Subscription {
    emit: (event: SubscriptionEvent, data?: unknown) => void
    query: string
    variables: Record<string, unknown>
}

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

const connectionPool = new Map<string, SharedConnection>()

export function _resetConnectionPool(): void {
    connectionPool.clear()
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

    connect(conn, removeFromPool)
    connectionPool.set(key, conn)
    return conn
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
