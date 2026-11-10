import { SdkError } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NhostDriver } from '../src/nhost-driver.ts'

const globalFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', globalFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    globalFetch.mockReset()
})

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

type Call = (resource: string, payload?: unknown, onEvent?: (event: string, data?: unknown) => void) => Promise<unknown>

function makeDriver(fetchImpl?: typeof fetch) {
    const driver = new NhostDriver({ endpoint: 'http://localhost:1337/v1/graphql', fetch: fetchImpl })
    return driver as unknown as { query: Call }
}

describe('nhost injected fetch', () => {
    it('sends requests through the injected fetch and never the global one', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: { users: [] } }))

        await makeDriver(injected as unknown as typeof fetch).query('users', {})

        expect(injected).toHaveBeenCalledTimes(1)
        expect(injected.mock.calls[0]?.[0]).toBe('http://localhost:1337/v1/graphql')
        expect(globalFetch).not.toHaveBeenCalled()
    })

    it('falls back to the global fetch when none is injected', async () => {
        globalFetch.mockResolvedValueOnce(jsonResponse(200, { data: { users: [] } }))

        await makeDriver().query('users', {})

        expect(globalFetch).toHaveBeenCalledTimes(1)
    })
})

describe('nhost typed errors', () => {
    it('throws an SdkError with status and parsed body on a non-OK response and emits them', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(401, { errors: [{ message: 'invalid token' }] }))
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .query('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(401)
        expect(error.message).toBe('HTTP 401')
        expect(error.errors).toEqual([{ message: 'invalid token' }])
        expect(events.filter(([event]) => event === 'error')).toEqual([
            ['error', { message: 'HTTP 401', status: 401, errors: [{ message: 'invalid token' }], resource: 'users', method: 'query' }],
        ])
    })

    it('throws an SdkError carrying the GraphQL errors on an application-level error', async () => {
        const graphqlErrors = [{ message: 'email must be unique' }, { message: 'name too long' }]
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: null, errors: graphqlErrors }))
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .query('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.message).toBe('email must be unique; name too long')
        expect(error.errors).toEqual(graphqlErrors)
        expect(events.filter(([event]) => event === 'error')).toEqual([
            ['error', { message: 'email must be unique; name too long', errors: graphqlErrors, resource: 'users', method: 'query' }],
        ])
    })

    it('keeps the message when the failing response has no JSON body', async () => {
        const injected = vi.fn().mockResolvedValueOnce(new Response('gateway down', { status: 502 }))

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .query('users', {})
            .catch(e => e)) as SdkError

        expect(error.status).toBe(502)
        expect(error.message).toBe('HTTP 502')
        expect(error.errors).toBeUndefined()
    })
})
