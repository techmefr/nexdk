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

describe('nest onResponse', () => {
    it('calls onResponse for every response', async () => {
        const seen: string[] = []
        const { sdk } = makeSdk({ onResponse: (response, request) => void seen.push(`${request.method} ${request.url} ${response.status}`) })
        await sdk.nest.users.create({ name: 'Ann' })
        expect(seen).toEqual(['POST http://api.test/users 200'])
    })
})
