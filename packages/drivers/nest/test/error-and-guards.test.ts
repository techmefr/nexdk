import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { createNestDriver } from '../src/driver.ts'

type Call = (resource: string, payload?: unknown, onEvent?: (event: string, data?: unknown) => void) => Promise<unknown>

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

function makeDriver(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
    return createNestDriver({ baseUrl: 'http://localhost:3000', fetch: fetchImpl, ...extra }) as unknown as {
        get: Call
        create: Call
    }
}

describe('nest error message', () => {
    it('exposes the joined validation messages and the same status on the error and the event', async () => {
        const injected = vi.fn().mockResolvedValue(
            jsonResponse(400, { statusCode: 400, message: ['email must be an email', 'name must be a string'], error: 'Bad Request' }),
        )
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .create('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error.message).toBe('email must be an email, name must be a string')
        expect(error.status).toBe(400)
        expect(events.find(([event]) => event === 'error')?.[1]).toEqual({ message: error.message, status: 400 })
    })
})

describe('nest resource name guard', () => {
    it.each(['', '.', '..'])('refuses the resource name "%s" before any request', async name => {
        const injected = vi.fn()

        await expect(makeDriver(injected as unknown as typeof fetch).get(name)).rejects.toThrow('Invalid resource name')
        expect(injected).not.toHaveBeenCalled()
    })
})

describe('nest timeout and signal', () => {
    it('forwards the abort signal and times out with status 0', async () => {
        const slow = vi.fn((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
            }),
        )

        const error = (await makeDriver(slow as unknown as typeof fetch, { timeout: 20 }).get('users').catch(e => e)) as SdkError

        expect(error.status).toBe(0)
    })
})
