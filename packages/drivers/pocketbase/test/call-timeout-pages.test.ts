import { describe, expect, it } from 'vitest'
import { createPocketbaseDriver } from '../src/driver.ts'

type Get = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

function pages(): { fetch: typeof globalThis.fetch; calls: () => number } {
    let calls = 0
    const fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
            calls++
            const page = calls
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            setTimeout(() => resolve(new Response(JSON.stringify({ page, perPage: 1, totalPages: 3, totalItems: 3, items: [{ id: String(page) }] }), { headers: { 'content-type': 'application/json' } })), 40)
        })) as typeof globalThis.fetch
    return { fetch, calls: () => calls }
}

describe('pocketbase per-call timeout on a paginated get', () => {
    it('covers the whole call, not each page', async () => {
        const { fetch, calls } = pages()
        const driver = createPocketbaseDriver({ baseUrl: 'http://api.test', fetch }) as unknown as { get: Get }
        const error = await driver.get('users', {}, undefined, { timeout: 100 }).catch(e => e)
        expect(calls()).toBeGreaterThanOrEqual(2)
        expect(error).toMatchObject({ status: 0, kind: 'timeout' })
    })

    it('reads every page when the call has time', async () => {
        const { fetch, calls } = pages()
        const driver = createPocketbaseDriver({ baseUrl: 'http://api.test', fetch }) as unknown as { get: Get }
        const rows = await driver.get('users', {}, undefined, { timeout: 1000 })
        expect(calls()).toBe(3)
        expect(rows).toHaveLength(3)
    })
})
