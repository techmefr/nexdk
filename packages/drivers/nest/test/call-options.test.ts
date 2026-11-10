import { createSdk } from 'nexdk'
import { describe, expect, it } from 'vitest'
import { createNestDriver } from '../src/driver.ts'
import type { NestConfig } from '../src/types.ts'

function backend() {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} })
        return new Promise<Response>((resolve, reject) => {
            if (init?.signal?.aborted) return reject(init.signal.reason)
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            setTimeout(() => resolve(new Response('[]', { headers: { 'Content-Type': 'application/json' } })), 20)
        })
    }
    return { calls, fetch }
}

function makeSdk(config: Partial<NestConfig> = {}) {
    const { calls, fetch } = backend()
    const sdk = createSdk({ drivers: { nest: createNestDriver({ baseUrl: 'http://api.test', fetch, ...config }) } }) as unknown as {
        nest: Record<string, Record<string, (payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<{ error?: unknown }>>>
    }
    return { sdk, calls }
}

describe('nest per-call options and onResponse', () => {
    it('sends the call headers and keeps the driver usable after an aborted call', async () => {
        const { sdk, calls } = makeSdk({ headers: { Authorization: 'Bearer driver' } })
        const controller = new AbortController()
        controller.abort()
        const aborted = await sdk.nest.users.get({}, undefined, { signal: controller.signal, headers: { 'X-Trace': '7' } })
        expect(aborted.error).toMatchObject({ status: 0, kind: 'abort' })
        expect(new Headers(calls[0].init.headers).get('x-trace')).toBe('7')
        expect(new Headers(calls[0].init.headers).get('authorization')).toBe('Bearer driver')
        expect((await sdk.nest.users.find({ id: 1 })).error).toBeUndefined()
    })

    it('times out a single call', async () => {
        const { sdk } = makeSdk()
        expect((await sdk.nest.users.remove({ id: 1 }, undefined, { timeout: 5 })).error).toMatchObject({ kind: 'timeout' })
    })
})
