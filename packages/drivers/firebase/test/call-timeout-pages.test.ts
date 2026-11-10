import { describe, expect, it } from 'vitest'
import { createFirebaseDriver } from '../src/driver.ts'

type Get = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

function pages(): { fetch: typeof globalThis.fetch; calls: () => number } {
    let calls = 0
    const fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
            calls++
            const page = calls
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            setTimeout(() => resolve(new Response(JSON.stringify({ documents: [{ name: `projects/p/databases/(default)/documents/users/${page}`, fields: {} }], nextPageToken: page < 3 ? `t${page}` : undefined }), { headers: { 'content-type': 'application/json' } })), 200)
        })) as typeof globalThis.fetch
    return { fetch, calls: () => calls }
}

describe('firebase per-call timeout on a paginated get', () => {
    it('covers the whole call, not each page', async () => {
        const { fetch, calls } = pages()
        const driver = createFirebaseDriver({ projectId: 'p', baseUrl: 'http://api.test', fetch }) as unknown as { get: Get }
        const error = await driver.get('users', {}, undefined, { timeout: 500 }).catch(e => e)
        expect(calls()).toBeGreaterThanOrEqual(2)
        expect(error).toMatchObject({ status: 0, kind: 'timeout' })
    })

    it('reads every page when the call has time', async () => {
        const { fetch, calls } = pages()
        const driver = createFirebaseDriver({ projectId: 'p', baseUrl: 'http://api.test', fetch }) as unknown as { get: Get }
        const rows = await driver.get('users', {}, undefined, { timeout: 5000 })
        expect(calls()).toBe(3)
        expect(rows).toHaveLength(3)
    })
})
