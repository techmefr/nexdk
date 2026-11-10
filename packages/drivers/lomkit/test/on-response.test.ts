import { createSdk, defineResource } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'
import type { LomkitConfig } from '../src/types.ts'

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Token': 'fresh' } })
}

function backend(status = 200, body: unknown = { data: [] }) {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} })
        return new Promise<Response>((resolve, reject) => {
            if (init?.signal?.aborted) return reject(init.signal.reason)
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            setTimeout(() => resolve(json(status, body)), 20)
        })
    })
    return { calls, fetch }
}

function makeSdk(config: Partial<LomkitConfig>, fetch: LomkitConfig['fetch']) {
    const events: Array<[SdkEvent, unknown]> = []
    const sdk = createSdk({
        drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://api.test', fetch, ...config }) },
        resources: { lomkit: { users } },
        notify: (event, data) => events.push([event, data]),
    })
    return { sdk, events }
}

describe('lomkit onResponse', () => {
    it('runs on every response with the url and the method', async () => {
        const seen: Array<[number, string, string, string | null]> = []
        const { fetch } = backend(422, { message: 'invalid', errors: {} })
        const { sdk } = makeSdk(
            { onResponse: (response, request) => void seen.push([response.status, request.url, request.method, response.headers.get('x-token')]) },
            fetch,
        )
        await sdk.lomkit.users.mutate({ operation: 'create', attributes: {} })
        expect(seen).toEqual([[422, 'http://api.test/users/mutate', 'POST', 'fresh']])
    })

    it('turns an exception of the hook into the error of the call', async () => {
        const failure = new Error('token refresh failed')
        const { fetch } = backend()
        const { sdk, events } = makeSdk({ onResponse: async () => Promise.reject(failure) }, fetch)
        const { error } = await sdk.lomkit.users.get({})
        expect(error).toBe(failure)
        expect(events.map(([event]) => event)).toEqual(['request', 'error'])
    })
})
