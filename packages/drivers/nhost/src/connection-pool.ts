export type SubHandler = (payload: unknown) => void

export interface Subscription {
    handler: SubHandler
    query: string
    variables: Record<string, unknown>
}

export type ConnectionInitHeaders = () => Record<string, string> | Promise<Record<string, string>>

export type PoolEventHandler = (event: 'connected' | 'disconnected', data?: unknown) => void

const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 15_000

export interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    pending: Array<{ id: string; query: string; variables: Record<string, unknown> }>
    handlers: Map<string, Subscription>
    refCount: number
    intentionalClose: boolean
    retryCount: number
    reconnectTimer: ReturnType<typeof setTimeout> | undefined
    readonly resolveInitHeaders: ConnectionInitHeaders
    readonly wsUrl: string
    readonly onEvent: PoolEventHandler | undefined
}

const connectionPool = new Map<string, SharedConnection>()

export function _resetConnectionPool(): void {
    connectionPool.clear()
}

export function backoffDelay(retryCount: number): number {
    return Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_MAX_MS)
}

const resolverIds = new WeakMap<object, number>()
let nextPoolId = 0

function poolKey(
    wsUrl: string,
    adminSecret: string | undefined,
    resolveHeaders: ConnectionInitHeaders | undefined,
): string {
    if (adminSecret === undefined || adminSecret === '') return `isolated|${++nextPoolId}`
    let resolverId = ''
    if (resolveHeaders !== undefined) {
        let id = resolverIds.get(resolveHeaders)
        if (id === undefined) {
            id = ++nextPoolId
            resolverIds.set(resolveHeaders, id)
        }
        resolverId = String(id)
    }
    return `${wsUrl}|${adminSecret}|${resolverId}`
}

export function getSharedConnection(
    wsUrl: string,
    adminSecret: string | undefined,
    resolveHeaders?: ConnectionInitHeaders,
    onEvent?: PoolEventHandler,
): SharedConnection {
    const key = poolKey(wsUrl, adminSecret, resolveHeaders)
    const existing = connectionPool.get(key)
    if (existing && !existing.intentionalClose
        && (existing.ws.readyState !== WebSocket.CLOSED || existing.reconnectTimer !== undefined)) {
        existing.refCount++
        return existing
    }

    const resolveInitHeaders: ConnectionInitHeaders = async () => {
        const dynamic = resolveHeaders ? await resolveHeaders() : {}
        return {
            ...(adminSecret ? { 'x-hasura-admin-secret': adminSecret } : {}),
            ...dynamic,
        }
    }

    const conn: SharedConnection = {
        ws: undefined as unknown as WebSocket,
        acknowledged: false,
        pending: [],
        handlers: new Map(),
        refCount: 1,
        intentionalClose: false,
        retryCount: 0,
        reconnectTimer: undefined,
        resolveInitHeaders,
        wsUrl,
        onEvent,
    }

    connect(conn, key)
    connectionPool.set(key, conn)
    return conn
}

function connect(conn: SharedConnection, key: string): void {
    conn.acknowledged = false
    conn.ws = new WebSocket(conn.wsUrl, 'graphql-transport-ws')

    conn.ws.onopen = () => {
        void Promise.resolve(conn.resolveInitHeaders()).then(headers => {
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
            conn.onEvent?.('connected')
            for (const [id, sub] of conn.handlers) {
                conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query: sub.query, variables: sub.variables } }))
            }
            for (const { id, query, variables } of conn.pending) {
                if (!conn.handlers.has(id)) {
                    conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query, variables } }))
                }
            }
            conn.pending = []
            return
        }

        if (msg.type === 'next' && msg.id) {
            conn.handlers.get(msg.id)?.handler(msg.payload)
        }
    }

    conn.ws.onclose = () => {
        conn.onEvent?.('disconnected')
        if (conn.intentionalClose) {
            connectionPool.delete(key)
            return
        }
        if (conn.handlers.size === 0 && conn.pending.length === 0) {
            connectionPool.delete(key)
            return
        }
        scheduleReconnect(conn, key)
    }
}

function scheduleReconnect(conn: SharedConnection, key: string): void {
    if (conn.reconnectTimer !== undefined) return
    const delay = backoffDelay(conn.retryCount)
    conn.retryCount++
    conn.reconnectTimer = setTimeout(() => {
        conn.reconnectTimer = undefined
        if (conn.intentionalClose || (conn.handlers.size === 0 && conn.pending.length === 0)) {
            connectionPool.delete(key)
            return
        }
        connect(conn, key)
    }, delay)
}
