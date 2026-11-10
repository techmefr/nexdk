import { SdkError } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSymfonyDriver } from '../src/driver.ts'

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
    const driver = createSymfonyDriver({ baseUrl: 'http://localhost:8000/api', fetch: fetchImpl })
    return driver as unknown as { get: Call }
}

describe('symfony injected fetch', () => {
    it('sends requests through the injected fetch and never the global one', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(200, []))

        await makeDriver(injected as unknown as typeof fetch).get('users', {})

        expect(injected).toHaveBeenCalledTimes(1)
        expect(globalFetch).not.toHaveBeenCalled()
    })

    it('falls back to the global fetch when none is injected', async () => {
        globalFetch.mockResolvedValueOnce(jsonResponse(200, []))

        await makeDriver().get('users', {})

        expect(globalFetch).toHaveBeenCalledTimes(1)
    })
})

describe('symfony typed errors', () => {
    const body = { message: 'The email field is required.', errors: { email: ['The email field is required.'] } }

    it('throws an SdkError carrying status, errors and data and emits them once', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(422, body))
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .get('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(422)
        expect(error.message).toBe(body.message)
        expect(error.errors).toEqual(body.errors)
        expect(error.data).toEqual(body)
        expect(events.filter(([event]) => event === 'error')).toEqual([
            ['error', { message: body.message, status: 422, errors: body.errors, kind: 'http', resource: 'users', method: 'get' }],
        ])
        expect(events.map(([event]) => event)).not.toContain('success')
    })

    it('reports the same status and errors on the thrown error and on the event when there are no field errors', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(500, {}))
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .get('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error.status).toBe(500)
        expect(error.errors).toBeUndefined()
        expect(events.find(([event]) => event === 'error')?.[1]).toEqual({ message: 'HTTP 500', status: 500, kind: 'http', resource: 'users', method: 'get' })
    })
})
