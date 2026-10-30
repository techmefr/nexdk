import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'

const UserSchema = z.object({ id: z.number(), name: z.string(), email: z.string() })
const userResource = defineResource({ name: 'users', schema: UserSchema })

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function makeDriver() {
    const driver = new LomkitDriver({ baseUrl: 'http://localhost:8000/api' })
    driver.bindResource('users', userResource)
    return driver
}

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('LomkitDriver.get', () => {
    it('posts to /resource/search and returns typed data', async () => {
        const payload = [{ id: 1, name: 'Alice', email: 'alice@test.com' }]
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: payload }))

        const driver = makeDriver()
        const result = await driver.get('users', { id: 1 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/search',
            expect.objectContaining({ method: 'POST' }),
        )
        expect(result.data).toEqual(payload)
    })

    it('emits request and success events', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }))

        const driver = makeDriver()
        const events: string[] = []
        await driver.get('users', {}, event => events.push(event))

        expect(events).toContain('request')
        expect(events).toContain('success')
    })
})

describe('LomkitDriver.mutate', () => {
    it('posts to /resource/mutate', async () => {
        mockFetch.mockResolvedValueOnce(
            jsonResponse(200, { data: [{ id: 1, name: 'Alice', email: 'alice@test.com' }] }),
        )

        const driver = makeDriver()
        await driver.mutate('users', { name: 'Alice', email: 'alice@test.com' })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/mutate',
            expect.objectContaining({ method: 'POST' }),
        )
    })

    it('throws on a 422 without a JSON body', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 422 }))

        const driver = makeDriver()
        await expect(driver.mutate('users', {})).rejects.toThrow()
    })

    it('emits 422 validation errors via the event handler and then throws', async () => {
        mockFetch.mockResolvedValueOnce(
            jsonResponse(422, {
                message: 'Validation failed',
                errors: { email: ['The email field is required.'] },
            }),
        )

        const driver = makeDriver()
        const errorPayloads: unknown[] = []
        await expect(
            driver.mutate('users', {}, (event, data) => {
                if (event === 'error') errorPayloads.push(data)
            }),
        ).rejects.toThrow('Validation failed')

        // The typed 'error' event carries the full validation detail, emitted once.
        expect(errorPayloads).toEqual([
            {
                message: 'Validation failed',
                errors: { email: ['The email field is required.'] },
            },
        ])
    })
})

describe('LomkitDriver headers', () => {
    it('applies static object headers to the request', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }))

        const driver = new LomkitDriver({
            baseUrl: 'http://localhost:8000/api',
            headers: { Authorization: 'Bearer static-token' },
        })
        driver.bindResource('users', userResource)
        await driver.get('users', {})

        const headers = new Headers(mockFetch.mock.calls[0][1].headers as HeadersInit)
        expect(headers.get('Authorization')).toBe('Bearer static-token')
        expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('resolves a function-form headers config before each request', async () => {
        mockFetch.mockImplementation(async () => jsonResponse(200, { data: [] }))

        let calls = 0
        const driver = new LomkitDriver({
            baseUrl: 'http://localhost:8000/api',
            headers: () => ({ Authorization: `Bearer token-${++calls}` }),
        })
        driver.bindResource('users', userResource)

        await driver.get('users', {})
        await driver.mutate('users', { name: 'Alice' })

        const first = new Headers(mockFetch.mock.calls[0][1].headers as HeadersInit)
        const second = new Headers(mockFetch.mock.calls[1][1].headers as HeadersInit)
        // The resolver runs per request, so a refreshed token is picked up.
        expect(first.get('Authorization')).toBe('Bearer token-1')
        expect(second.get('Authorization')).toBe('Bearer token-2')
    })

    it('awaits an async function-form headers config', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }))

        const driver = new LomkitDriver({
            baseUrl: 'http://localhost:8000/api',
            headers: async () => {
                await Promise.resolve()
                return { Authorization: 'Bearer refreshed' }
            },
        })
        driver.bindResource('users', userResource)
        await driver.get('users', {})

        const headers = new Headers(mockFetch.mock.calls[0][1].headers as HeadersInit)
        expect(headers.get('Authorization')).toBe('Bearer refreshed')
    })
})

describe('LomkitDriver error contract', () => {
    it('get throws on a non-OK HTTP response instead of returning an empty list', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(500, {}))

        const driver = makeDriver()
        const events: string[] = []
        await expect(
            driver.get('users', {}, event => events.push(event)),
        ).rejects.toThrow('HTTP 500')

        // 'error' is emitted exactly once (not duplicated by the catch block).
        expect(events.filter(e => e === 'error')).toHaveLength(1)
    })

    it('delete throws on a non-OK HTTP response instead of returning success:false', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(404, {}))

        const driver = makeDriver()
        await expect(driver.delete('users', { resources: [1] })).rejects.toThrow('HTTP 404')
    })

    it('get rethrows a network error and emits a single error event', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'))

        const driver = makeDriver()
        const events: string[] = []
        await expect(
            driver.get('users', {}, event => events.push(event)),
        ).rejects.toThrow('network down')

        expect(events.filter(e => e === 'error')).toHaveLength(1)
    })
})

describe('LomkitDriver encoding and handler isolation', () => {
    it('encodes the resource name in the URL', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }))
        const driver = new LomkitDriver({ baseUrl: 'http://localhost:8000/api' })
        await driver.get('a/b?c', {})
        expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/api/a%2Fb%3Fc/search')
    })

    it.each(['get', 'mutate', 'delete'] as const)('%s keeps a success when the success handler throws', async method => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }))
        const events: string[] = []
        const onEvent = (event: string) => {
            events.push(event)
            if (event === 'success') throw new Error('handler boom')
        }
        const driver = makeDriver()

        await expect(driver[method]('users', {}, onEvent)).rejects.toThrow('handler boom')
        expect(events).toEqual(['request', 'success'])
    })
})
