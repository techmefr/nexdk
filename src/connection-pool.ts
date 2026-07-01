export type SubHandler = (payload: unknown) => void

// A registered subscription: its handler plus the query/variables needed to
// replay the `subscribe` frame after a reconnect.
export interface Subscription {
    handler: SubHandler
    query: string
    variables: Record<string, unknown>
}

// Resolves the headers merged into the `connection_init` payload. Called on
// every (re)connect so a refreshed token is picked up after a reconnect.
export type ConnectionInitHeaders = () => Record<string, string> | Promise<Record<string, string>>

// Optional pool event sink (uses the beepr event vocabulary where relevant).
export type PoolEventHandler = (event: 'connected' | 'disconnected', data?: unknown) => void

// Backoff bounds for reconnect attempts.
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 15_000

export interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    // pending subscriptions queued before ack
    pending: Array<{ id: string; query: string; variables: Record<string, unknown> }>
    // active subscriptions keyed by id (handler + replayable query/variables)
    handlers: Map<string, Subscription>
    refCount: number
    // Set when the last unsubscribe closes the socket, so onclose does not reconnect.
    intentionalClose: boolean
    // Current reconnect attempt count (0 while connected), and the pending timer.
    retryCount: number
    reconnectTimer: ReturnType<typeof setTimeout> | undefined
    // Bound to the pool key so (re)connects reuse the same endpoint/secret.
    readonly resolveInitHeaders: ConnectionInitHeaders
    readonly wsUrl: string
    readonly onEvent: PoolEventHandler | undefined
}

// One shared WS connection per (endpoint + adminSecret) key
const connectionPool = new Map<string, SharedConnection>()

// Test-only: clear the module-level pool so a suite starts from a clean slate.
export function _resetConnectionPool(): void {
    connectionPool.clear()
}

// Compute the delay for the next reconnect attempt (exponential, capped).
export function backoffDelay(retryCount: number): number {
    return Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_MAX_MS)
}

export function getSharedConnection(
    wsUrl: string,
    adminSecret: string | undefined,
    resolveHeaders?: ConnectionInitHeaders,
    onEvent?: PoolEventHandler,
): SharedConnection {
    const key = `${wsUrl}|${adminSecret ?? ''}`
    const existing = connectionPool.get(key)
    // Reuse the live socket, and also a socket that is temporarily closed while a
    // reconnect is pending (its subscriptions are replayed on the new socket).
    if (existing && !existing.intentionalClose
        && (existing.ws.readyState !== WebSocket.CLOSED || existing.reconnectTimer !== undefined)) {
        existing.refCount++
        return existing
    }

    // Merge the admin-secret (if any) with the dynamically resolved headers.
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

// Open a fresh socket for `conn` and wire its handlers. Reused for the initial
// connect and every reconnect.
function connect(conn: SharedConnection, key: string): void {
    conn.acknowledged = false
    conn.ws = new WebSocket(conn.wsUrl, 'graphql-transport-ws')

    conn.ws.onopen = () => {
        // Resolve headers on every (re)connect so a refreshed token is used.
        void Promise.resolve(conn.resolveInitHeaders()).then(headers => {
            const payload: Record<string, unknown> = {}
            if (Object.keys(headers).length > 0) payload.headers = headers
            conn.ws.send(JSON.stringify({ type: 'connection_init', payload }))
        })
    }

    conn.ws.onmessage = event => {
        const msg = JSON.parse(event.data as string) as { type: string; id?: string; payload?: unknown }

        if (msg.type === 'ping') {
            conn.ws.send(JSON.stringify({ type: 'pong' }))
            return
        }

        if (msg.type === 'connection_ack' && !conn.acknowledged) {
            conn.acknowledged = true
            conn.retryCount = 0
            conn.onEvent?.('connected')
            // Replay every still-active subscription (survives reconnects).
            for (const [id, sub] of conn.handlers) {
                conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query: sub.query, variables: sub.variables } }))
            }
            // Flush any subscriptions queued before this ack that are not yet
            // tracked as active handlers (added between connect and ack).
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
        // Intentional teardown (refCount hit 0) never reconnects.
        if (conn.intentionalClose) {
            connectionPool.delete(key)
            return
        }
        // Nothing left to keep alive: drop the entry, no reconnect.
        if (conn.handlers.size === 0 && conn.pending.length === 0) {
            connectionPool.delete(key)
            return
        }
        scheduleReconnect(conn, key)
    }
}

// Schedule a reconnect using exponential backoff, capped, while handlers remain.
function scheduleReconnect(conn: SharedConnection, key: string): void {
    if (conn.reconnectTimer !== undefined) return
    const delay = backoffDelay(conn.retryCount)
    conn.retryCount++
    conn.reconnectTimer = setTimeout(() => {
        conn.reconnectTimer = undefined
        // Bail if everything was torn down while waiting.
        if (conn.intentionalClose || (conn.handlers.size === 0 && conn.pending.length === 0)) {
            connectionPool.delete(key)
            return
        }
        connect(conn, key)
    }, delay)
}
