import { defineResource } from '@pilota/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { NhostDriver } from '../src/driver.ts'

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

describe('NhostDriver.subscription', () => {
    it('returns a cleanup function', () => {
        const driver = makeDriver()

        const MockWebSocket = vi.fn(() => ({
            send: vi.fn(),
            close: vi.fn(),
            onopen: null as null | (() => void),
            onmessage: null,
        }))
        vi.stubGlobal('WebSocket', MockWebSocket)

        const unsub = driver.subscription('messages', { room_id: 'room-1' })
        expect(typeof unsub).toBe('function')
        expect(() => unsub()).not.toThrow()

        vi.unstubAllGlobals()
    })
})
