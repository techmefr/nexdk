import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetConnectionPool } from '../src/connection-pool.ts'
import { NhostDriver } from '../src/nhost-driver.ts'

class MockWebSocket {
    static OPEN = 1
    static CLOSED = 3
    static instances: MockWebSocket[] = []
    readyState = MockWebSocket.OPEN
    sent: Array<Record<string, unknown>> = []
    onopen: null | (() => void) = null
    onmessage: null | ((e: { data: string }) => void) = null
    onclose: null | ((e?: { code: number; reason: string }) => void) = null
    constructor(public url: string, public protocol?: string) {
        MockWebSocket.instances.push(this)
    }
    send(raw: string) {
        this.sent.push(JSON.parse(raw))
    }
    close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code: 1000, reason: '' })
    }
    ack() {
        this.receive({ type: 'connection_ack' })
    }
    receive(message: Record<string, unknown>) {
        this.onmessage?.({ data: JSON.stringify(message) })
    }
    closeWith(code: number, reason = '') {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code, reason })
    }
}

const ENDPOINT = 'http://localhost:1337/v1/graphql'

function makeDriver(config: Record<string, unknown> = {}) {
    return new NhostDriver({ endpoint: ENDPOINT, adminSecret: 's', ...config })
}

function subscribe(driver: ReturnType<typeof makeDriver>) {
    const events: Array<[string, unknown]> = []
    const stop = driver.subscription('users', {}, (event, data) => events.push([event, data]))
    return { events, stop, names: () => events.map(([event]) => event).filter(event => event !== 'request') }
}

function subscribeId(ws: MockWebSocket): string {
    return ws.sent.find(frame => frame.type === 'subscribe')?.id as string
}

beforeEach(() => {
    _resetConnectionPool()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('nhost subscription lifecycle events', () => {
    it('emits connected on ack and disconnected when the last subscription stops', () => {
        const { names, stop } = subscribe(makeDriver())
        MockWebSocket.instances[0].ack()

        expect(names()).toEqual(['connected'])

        stop()

        expect(names()).toEqual(['connected', 'disconnected'])
    })

    it('emits connected immediately for a subscription added after the ack', () => {
        const driver = makeDriver()
        subscribe(driver)
        MockWebSocket.instances[0].ack()

        const second = subscribe(driver)

        expect(second.names()).toEqual(['connected'])
    })

    it('emits disconnected then connected around a reconnect', () => {
        vi.useFakeTimers()
        const { names } = subscribe(makeDriver())
        const first = MockWebSocket.instances[0]
        first.ack()

        first.closeWith(1006)
        vi.advanceTimersByTime(600)
        MockWebSocket.instances[1].ack()

        expect(names()).toEqual(['connected', 'disconnected', 'connected'])
    })

    it('does not emit disconnected to a subscription that stops while others keep the socket', () => {
        const driver = makeDriver()
        const first = subscribe(driver)
        subscribe(driver)
        MockWebSocket.instances[0].ack()

        first.stop()

        expect(first.names()).toEqual(['connected'])
    })
})

describe('nhost subscription error and complete', () => {
    it('forwards a subscription error and stops that subscription only', () => {
        const driver = makeDriver()
        const failing = subscribe(driver)
        const healthy = subscribe(driver)
        const ws = MockWebSocket.instances[0]
        ws.ack()
        const id = subscribeId(ws)

        ws.receive({ type: 'error', id, payload: [{ message: 'field "nope" not found' }, { message: 'second' }] })
        ws.receive({ type: 'next', id, payload: { data: {} } })

        expect(failing.events.find(([event]) => event === 'error')).toEqual([
            'error',
            { message: 'field "nope" not found; second', errors: [{ message: 'field "nope" not found' }, { message: 'second' }] },
        ])
        expect(failing.names()).not.toContain('data')
        expect(healthy.names()).toEqual(['connected'])
    })

    it('forwards complete and does not send a second complete on unsubscribe', () => {
        const { names, stop } = subscribe(makeDriver())
        const ws = MockWebSocket.instances[0]
        ws.ack()
        const id = subscribeId(ws)

        ws.receive({ type: 'complete', id })
        stop()

        expect(names()).toContain('complete')
        expect(ws.sent.filter(frame => frame.type === 'complete')).toEqual([])
        expect(ws.readyState).toBe(MockWebSocket.CLOSED)
    })

    it('ignores messages for unknown subscription ids', () => {
        const { names } = subscribe(makeDriver())
        const ws = MockWebSocket.instances[0]
        ws.ack()

        ws.receive({ type: 'error', id: 'unknown', payload: [] })

        expect(names()).toEqual(['connected'])
    })
})

describe('nhost rejected connection', () => {
    it.each([4400, 4401, 4403, 4499])('emits error and does not reconnect after close code %i', code => {
        vi.useFakeTimers()
        const { names, events } = subscribe(makeDriver())
        const errorEvent = () => events.find(([event]) => event === 'error')
        const ws = MockWebSocket.instances[0]

        ws.closeWith(code, 'bad secret')
        vi.advanceTimersByTime(60_000)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(names()).toEqual(['disconnected', 'error'])
        expect(errorEvent()?.[1]).toMatchObject({ message: `WebSocket closed with code ${code}: bad secret`, code })
    })

    it('still reconnects after a normal abnormal close', () => {
        vi.useFakeTimers()
        subscribe(makeDriver())

        MockWebSocket.instances[0].closeWith(1006)
        vi.advanceTimersByTime(600)

        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('opens a fresh socket for a new subscription after a rejection', () => {
        const driver = makeDriver()
        subscribe(driver)
        MockWebSocket.instances[0].closeWith(4401)

        subscribe(driver)

        expect(MockWebSocket.instances).toHaveLength(2)
    })
})

describe('nhost pool key race', () => {
    it('keeps a socket opened right after the last unsubscribe in the pool', () => {
        const driver = makeDriver()
        subscribe(driver).stop()
        subscribe(driver)

        expect(MockWebSocket.instances).toHaveLength(2)

        subscribe(driver)

        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('does not decrement twice when a subscription is stopped twice', () => {
        const driver = makeDriver()
        const first = subscribe(driver)
        subscribe(driver)

        first.stop()
        first.stop()

        expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.OPEN)
    })

    it('does not send subscribe for a subscription removed before the ack', () => {
        const { stop } = subscribe(makeDriver())
        const ws = MockWebSocket.instances[0]
        stop()
        ws.ack()

        expect(ws.sent.filter(frame => frame.type === 'subscribe')).toEqual([])
    })
})

describe('nhost pool sharing between driver instances', () => {
    it('shares one socket between instances configured with the same header resolver', () => {
        const headers = () => ({ Authorization: 'Bearer t' })

        subscribe(makeDriver({ headers }))
        subscribe(makeDriver({ headers }))

        expect(MockWebSocket.instances).toHaveLength(1)
    })

    it('does not share between instances with different resolvers', () => {
        subscribe(makeDriver({ headers: () => ({}) }))
        subscribe(makeDriver({ headers: () => ({}) }))

        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('keeps one socket per instance when no resolver is configured', () => {
        subscribe(makeDriver())
        subscribe(makeDriver())

        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('shares inside one instance without a resolver', () => {
        const driver = makeDriver()

        subscribe(driver)
        subscribe(driver)

        expect(MockWebSocket.instances).toHaveLength(1)
    })
})
