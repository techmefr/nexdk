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

describe('NhostDriver.query', () => {
    it('sends a GraphQL query with fields from default fragment', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { users: [] } }),
        })

        const driver = makeDriver()
        await driver.query('users', {})

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
            query: string
        }
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

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
            query: string
        }
        expect(body.query).toContain('posts { id title }')
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

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { query: string }
        expect(body.query).toContain('insert_users_one')
        expect(body.query).toContain('Alice')
    })

    it('generates an update_by_pk mutation via updateById', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { update_users_by_pk: { id: '1', name: 'Alice', email: 'alice@test.com' } } }),
        })

        const driver = makeDriver()
        await driver.updateById('users', { id: '1', data: { name: 'Alice' } })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { query: string }
        expect(body.query).toContain('update_users_by_pk')
        expect(body.query).toContain('"1"')
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
