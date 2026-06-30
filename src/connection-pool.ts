export type SubHandler = (payload: unknown) => void

export interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    // pending subscriptions queued before ack
    pending: Array<{ id: string; query: string; variables: Record<string, unknown> }>
    // active subscription handlers keyed by id
    handlers: Map<string, SubHandler>
    refCount: number
}

// One shared WS connection per (endpoint + adminSecret) key
const connectionPool = new Map<string, SharedConnection>()

export function getSharedConnection(wsUrl: string, adminSecret: string | undefined): SharedConnection {
    const key = `${wsUrl}|${adminSecret ?? ''}`
    const existing = connectionPool.get(key)
    if (existing && existing.ws.readyState !== WebSocket.CLOSED) {
        existing.refCount++
        return existing
    }

    const conn: SharedConnection = {
        ws: new WebSocket(wsUrl, 'graphql-transport-ws'),
        acknowledged: false,
        pending: [],
        handlers: new Map(),
        refCount: 1,
    }

    conn.ws.onopen = () => {
        const initPayload: Record<string, unknown> = {}
        if (adminSecret) initPayload.headers = { 'x-hasura-admin-secret': adminSecret }
        conn.ws.send(JSON.stringify({ type: 'connection_init', payload: initPayload }))
    }

    conn.ws.onmessage = event => {
        const msg = JSON.parse(event.data as string) as { type: string; id?: string; payload?: unknown }

        if (msg.type === 'ping') {
            conn.ws.send(JSON.stringify({ type: 'pong' }))
            return
        }

        if (msg.type === 'connection_ack' && !conn.acknowledged) {
            conn.acknowledged = true
            for (const { id, query, variables } of conn.pending) {
                conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query, variables } }))
            }
            conn.pending = []
            return
        }

        if (msg.type === 'next' && msg.id) {
            conn.handlers.get(msg.id)?.(msg.payload)
        }
    }

    conn.ws.onclose = () => { connectionPool.delete(key) }

    connectionPool.set(key, conn)
    return conn
}
