import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { NhostDriver } from '../src/nhost-driver.ts'
import { _resetConnectionPool } from '../src/connection-pool.ts'

const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
})

const userResource = defineResource({
    name: 'users',
    schema: UserSchema,
    fragments: {
        default: ['id', 'name', 'email'],
        withPosts: ['id', 'name', 'email', 'posts { id title }'],
    },
})

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function makeDriver() {
    const driver = new NhostDriver({ endpoint: 'http://localhost:1337/v1/graphql' })
    driver.bindResource('users', userResource)
    return driver
}

function parseBody() {
    return JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        query: string
        variables: Record<string, unknown>
    }
}

describe('NhostDriver.query', () => {
    it('sends a GraphQL query with fields from default fragment', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { users: [] } }),
        })

        const driver = makeDriver()
        await driver.query('users', {})

        const body = parseBody()
        expect(body.query).toContain('query Get')
        expect(body.query).toContain('id name email')
    })

    it('uses withPosts fragment when specified', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { users: [] } }),
        })

        const driver = makeDriver()
        await driver.query('users', {}, undefined, { fragment: 'withPosts' })

        const body = parseBody()
        expect(body.query).toContain('posts { id title }')
    })

    it('passes query arguments as typed GraphQL variables, not interpolated', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { users: [] } }),
        })

        const driver = makeDriver()
        const where = { name: { _eq: 'Alice' } }
        await driver.query('users', { where, limit: 10 })

        const body = parseBody()
        // Variable declarations and references appear in the document
        expect(body.query).toContain('$where: users_bool_exp')
        expect(body.query).toContain('where: $where')
        expect(body.query).toContain('$limit: Int')
        // The actual values travel via the variables map
        expect(body.variables).toEqual({ where, limit: 10 })
        // The raw value is NOT interpolated into the document
        expect(body.query).not.toContain('Alice')
    })
})

describe('NhostDriver.mutation', () => {
    it('generates an insert_one mutation', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { insert_users_one: { id: '1', name: 'Alice', email: 'alice@test.com' } } }),
        })

        const driver = makeDriver()
        await driver.mutation('users', { name: 'Alice', email: 'alice@test.com' })

        const body = parseBody()
        expect(body.query).toContain('insert_users_one')
        expect(body.query).toContain('$object: users_insert_input!')
        expect(body.query).toContain('object: $object')
        // User data travels via variables, not interpolated into the document
        expect(body.variables).toEqual({ object: { name: 'Alice', email: 'alice@test.com' } })
        expect(body.query).not.toContain('Alice')
    })

    it('generates an update_by_pk mutation via updateById', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { update_users_by_pk: { id: '1', name: 'Alice', email: 'alice@test.com' } } }),
        })

        const driver = makeDriver()
        await driver.updateById('users', { id: '1', data: { name: 'Alice' } })

        const body = parseBody()
        expect(body.query).toContain('update_users_by_pk')
        expect(body.query).toContain('pk_columns: $pk')
        expect(body.query).toContain('_set: $set')
        expect(body.variables).toEqual({ pk: { id: '1' }, set: { name: 'Alice' } })
        // id and data are not interpolated into the document
        expect(body.query).not.toContain('"1"')
    })

    it('does not allow a string containing a quote to break or inject into the document', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { insert_users_one: { id: '1' } } }),
        })

        const driver = makeDriver()
        // Malicious / awkward value with a double quote, backslash and newline
        const evil = 'Robert"); } mutation { delete_users { id } } #\n\\'
        await driver.mutation('users', { name: evil })

        const body = parseBody()
        // The dangerous value is confined to variables, never the query string
        expect(body.variables).toEqual({ object: { name: evil } })
        expect(body.query).not.toContain('delete_users')
        expect(body.query).not.toContain(evil)
        // Document still contains exactly one operation
        expect(body.query.match(/mutation/g)?.length).toBe(1)
    })
})

describe('NhostDriver.upsert / updateWhere / deleteById', () => {
    it('upsert keeps enum identifiers inline and user data in variables', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { insert_users_one: { id: '1' } } }),
        })

        const driver = makeDriver()
        await driver.upsert('users', {
            data: { id: '1', name: 'Alice' },
            conflictConstraint: 'users_pkey',
            updateColumns: ['name', 'email'],
        })

        const body = parseBody()
        expect(body.query).toContain('$object: users_insert_input!')
        expect(body.query).toContain('constraint: users_pkey')
        expect(body.query).toContain('update_columns: [name, email]')
        expect(body.variables).toEqual({ object: { id: '1', name: 'Alice' } })
    })

    it('upsert rejects an invalid enum identifier', async () => {
        const driver = makeDriver()
        await expect(
            driver.upsert('users', {
                data: { id: '1' },
                conflictConstraint: 'users_pkey") { id } } #',
                updateColumns: ['name'],
            }),
        ).rejects.toThrow('Invalid GraphQL enum identifier')
    })

    it('updateWhere passes where and data as variables', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { update_users: { affected_rows: 2 } } }),
        })

        const driver = makeDriver()
        const result = await driver.updateWhere('users', {
            where: { name: { _eq: 'Alice' } },
            data: { email: 'new@test.com' },
        })

        const body = parseBody()
        expect(body.query).toContain('$where: users_bool_exp!')
        expect(body.query).toContain('$set: users_set_input!')
        expect(body.variables).toEqual({ where: { name: { _eq: 'Alice' } }, set: { email: 'new@test.com' } })
        expect(result.affectedRows).toBe(2)
    })

    it('deleteById passes the id as a variable', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { delete_users_by_pk: { id: '1' } } }),
        })

        const driver = makeDriver()
        await driver.deleteById('users', { id: '1' })

        const body = parseBody()
        expect(body.query).toContain('$id: uuid!')
        expect(body.query).toContain('delete_users_by_pk(id: $id)')
        expect(body.variables).toEqual({ id: '1' })
        expect(body.query).not.toContain('"1"')
    })

    it('deleteById throws on a non-OK HTTP response instead of returning success:false', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

        const driver = makeDriver()
        const events: string[] = []
        await expect(
            driver.deleteById('users', { id: '1' }, event => events.push(event)),
        ).rejects.toThrow('HTTP 500')

        expect(events).toContain('error')
    })
})

describe('NhostDriver headers', () => {
    it('applies a static object headers config to the request', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { users: [] } }) })

        const driver = new NhostDriver({
            endpoint: 'http://localhost:1337/v1/graphql',
            headers: { Authorization: 'Bearer static' },
        })
        driver.bindResource('users', userResource)
        await driver.query('users', {})

        const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer static')
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('resolves an async function-form headers config per request', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: { users: [] } }) })

        let calls = 0
        const driver = new NhostDriver({
            endpoint: 'http://localhost:1337/v1/graphql',
            headers: async () => {
                await Promise.resolve()
                return { Authorization: `Bearer token-${++calls}` }
            },
        })
        driver.bindResource('users', userResource)

        await driver.query('users', {})
        await driver.query('users', {})

        const first = mockFetch.mock.calls[0][1].headers as Record<string, string>
        const second = mockFetch.mock.calls[1][1].headers as Record<string, string>
        expect(first.Authorization).toBe('Bearer token-1')
        expect(second.Authorization).toBe('Bearer token-2')
    })
})

describe('singular', () => {
    it('does not mangle words ending in ss/us/is', async () => {
        // singular() now lives in the document module (was a private driver method).
        const { singular } = await import('../src/document.ts')
        expect(singular('status')).toBe('Status')
        expect(singular('bus')).toBe('Bus')
        expect(singular('axis')).toBe('Axis')
        expect(singular('categories')).toBe('Category')
        expect(singular('users')).toBe('User')
    })
})

// A minimal graphql-transport-ws mock that records sent frames and lets tests
// drive lifecycle callbacks. Exposes the static readyState constants the pool
// relies on.
class MockWebSocket {
    static OPEN = 1
    static CLOSED = 3
    static instances: MockWebSocket[] = []
    readyState = MockWebSocket.OPEN
    sent: Array<Record<string, unknown>> = []
    onopen: null | (() => void) = null
    onmessage: null | ((e: { data: string }) => void) = null
    onclose: null | (() => void) = null
    constructor(public url: string, public protocol?: string) {
        MockWebSocket.instances.push(this)
    }
    send(raw: string) { this.sent.push(JSON.parse(raw)) }
    close() { this.readyState = MockWebSocket.CLOSED; this.onclose?.() }
    // Test helpers
    open() { this.onopen?.() }
    ack() { this.onmessage?.({ data: JSON.stringify({ type: 'connection_ack' }) }) }
    drop() { this.readyState = MockWebSocket.CLOSED; this.onclose?.() }
}

describe('NhostDriver.subscription', () => {
    beforeEach(() => {
        _resetConnectionPool()
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns a cleanup function', () => {
        const driver = makeDriver()
        const unsub = driver.subscription('messages', { room_id: 'room-1' })
        expect(typeof unsub).toBe('function')
        expect(() => unsub()).not.toThrow()
    })

    it('uses a uuid-shaped subscription id', () => {
        const driver = makeDriver()
        driver.subscription('users', {})
        const ws = MockWebSocket.instances[0]
        ws.open()
        ws.ack()

        const subscribe = ws.sent.find(f => f.type === 'subscribe')
        expect(subscribe).toBeDefined()
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        expect(uuid.test(subscribe!.id as string)).toBe(true)
    })

    it('resolves function-form headers into the connection_init payload', async () => {
        const driver = new NhostDriver({
            endpoint: 'http://localhost:1337/v1/graphql',
            headers: () => ({ Authorization: 'Bearer ws-token' }),
        })
        driver.bindResource('users', userResource)
        driver.subscription('users', {})

        const ws = MockWebSocket.instances[0]
        ws.open()
        // onopen resolves headers asynchronously; flush the microtask queue.
        for (let i = 0; i < 5; i++) await Promise.resolve()

        const init = ws.sent.find(f => f.type === 'connection_init')
        expect(init).toBeDefined()
        expect((init!.payload as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer ws-token')
    })

    it('reconnects on an unexpected close and replays active subscriptions', () => {
        vi.useFakeTimers()
        const driver = makeDriver()
        driver.subscription('users', { where: { name: { _eq: 'A' } } })

        const first = MockWebSocket.instances[0]
        first.open()
        first.ack()
        const originalSubscribe = first.sent.find(f => f.type === 'subscribe')
        expect(originalSubscribe).toBeDefined()

        // Unexpected drop (not an intentional teardown).
        first.drop()

        // A reconnect is scheduled with backoff; advance time to fire it.
        expect(MockWebSocket.instances).toHaveLength(1)
        vi.advanceTimersByTime(600)
        expect(MockWebSocket.instances).toHaveLength(2)

        // New socket connects, acks, and replays the subscription with the same id.
        const second = MockWebSocket.instances[1]
        second.open()
        second.ack()
        const replayed = second.sent.find(f => f.type === 'subscribe')
        expect(replayed).toBeDefined()
        expect(replayed!.id).toBe(originalSubscribe!.id)
        expect((replayed!.payload as { variables: unknown }).variables).toEqual({ where: { name: { _eq: 'A' } } })
    })

    it('does not reconnect after an intentional teardown', () => {
        vi.useFakeTimers()
        const driver = makeDriver()
        const unsub = driver.subscription('users', {})
        const ws = MockWebSocket.instances[0]
        ws.open()
        ws.ack()

        // Last unsubscribe -> refCount 0 -> intentional close.
        unsub()

        vi.advanceTimersByTime(20_000)
        expect(MockWebSocket.instances).toHaveLength(1)
    })
})

describe('backoffDelay', () => {
    it('grows exponentially and is capped', async () => {
        const { backoffDelay } = await import('../src/connection-pool.ts')
        expect(backoffDelay(0)).toBe(500)
        expect(backoffDelay(1)).toBe(1000)
        expect(backoffDelay(2)).toBe(2000)
        // Capped at 15s.
        expect(backoffDelay(10)).toBe(15_000)
    })
})
