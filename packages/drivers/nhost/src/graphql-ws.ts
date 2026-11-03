import type { SharedConnection, Subscription, SubscriptionEvent } from './connection-pool.ts'

const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 15_000
const REJECTED_CLOSE_CODES = { min: 4400, max: 4499 }

type Retire = (conn: SharedConnection) => void

interface GraphQLMessage {
    message?: string
}

interface ProtocolMessage {
    type: string
    id?: string
    payload?: unknown
}

export function backoffDelay(retryCount: number): number {
    return Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_MAX_MS)
}

function broadcast(conn: SharedConnection, event: SubscriptionEvent, data?: unknown): void {
    for (const subscription of [...conn.handlers.values()]) subscription.emit(event, data)
}

export function sendSubscribe(conn: SharedConnection, id: string, subscription: Subscription): void {
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

export function connect(conn: SharedConnection, retire: Retire): void {
    conn.acknowledged = false
    conn.ws = new WebSocket(conn.wsUrl, 'graphql-transport-ws')

    conn.ws.onopen = () => {
        void Promise.resolve(conn.initHeaders()).then(headers => {
            const payload: Record<string, unknown> = {}
            if (Object.keys(headers).length > 0) payload.headers = headers
            conn.ws.send(JSON.stringify({ type: 'connection_init', payload }))
        })
    }

    conn.ws.onmessage = event => handleMessage(conn, event.data)

    conn.ws.onclose = closeEvent => handleClose(conn, closeEvent, retire)
}

function handleMessage(conn: SharedConnection, raw: unknown): void {
    let msg: ProtocolMessage
    try {
        msg = JSON.parse(raw as string)
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

function handleClose(conn: SharedConnection, closeEvent: CloseEvent, retire: Retire): void {
    if (conn.intentionalClose) {
        retire(conn)
        return
    }
    broadcast(conn, 'disconnected')
    const code = closeEvent?.code
    if (code !== undefined && code >= REJECTED_CLOSE_CODES.min && code <= REJECTED_CLOSE_CODES.max) {
        const reason = closeEvent.reason ? `: ${closeEvent.reason}` : ''
        broadcast(conn, 'error', { message: `WebSocket closed with code ${code}${reason}`, code, reason: closeEvent.reason })
        conn.handlers.clear()
        conn.intentionalClose = true
        retire(conn)
        return
    }
    if (conn.handlers.size === 0) {
        retire(conn)
        return
    }
    scheduleReconnect(conn, retire)
}

function scheduleReconnect(conn: SharedConnection, retire: Retire): void {
    if (conn.reconnectTimer !== undefined) return
    const delay = backoffDelay(conn.retryCount)
    conn.retryCount++
    conn.reconnectTimer = setTimeout(() => {
        conn.reconnectTimer = undefined
        if (conn.intentionalClose || conn.handlers.size === 0) {
            retire(conn)
            return
        }
        connect(conn, retire)
    }, delay)
}
