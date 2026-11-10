import { describe, expect, it } from 'vitest'
import { HttpError, request } from '../src/request.ts'
import type { FetchLike } from '../src/index.ts'

const hanging: FetchLike = (_input, init) =>
    new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    })

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('HttpError kind', () => {
    it('is timeout with status 0 and the abort reason as cause', async () => {
        const error = (await request('http://api.test/a', { fetch: hanging, timeout: 10 }).catch(e => e)) as HttpError
        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(0)
        expect(error.kind).toBe('timeout')
        expect((error.cause as Error).name).toBe('TimeoutError')
    })

    it('is abort when the caller aborts', async () => {
        const controller = new AbortController()
        const pending = request('http://api.test/a', { fetch: hanging, signal: controller.signal }).catch(e => e)
        controller.abort()
        const error = (await pending) as HttpError
        expect(error.status).toBe(0)
        expect(error.kind).toBe('abort')
        expect((error.cause as Error).name).toBe('AbortError')
    })

    it('is timeout for a caller signal built with AbortSignal.timeout', async () => {
        const error = (await request('http://api.test/a', { fetch: hanging, signal: AbortSignal.timeout(10) }).catch(e => e)) as HttpError
        expect(error.kind).toBe('timeout')
    })

    it('is network when fetch rejects on its own', async () => {
        const cause = new TypeError('fetch failed')
        const error = (await request('http://api.test/a', { fetch: () => Promise.reject(cause) }).catch(e => e)) as HttpError
        expect(error.status).toBe(0)
        expect(error.kind).toBe('network')
        expect(error.cause).toBe(cause)
    })

    it('is http for a 4xx or 5xx answer', async () => {
        const error = (await request('http://api.test/a', { fetch: async () => json(503, {}) }).catch(e => e)) as HttpError
        expect(error.status).toBe(503)
        expect(error.kind).toBe('http')
        expect(error.cause).toBeUndefined()
    })

    it('applies the timeout even when a signal is given', async () => {
        const controller = new AbortController()
        const error = (await request('http://api.test/a', { fetch: hanging, signal: controller.signal, timeout: 10 }).catch(e => e)) as HttpError
        expect(error.kind).toBe('timeout')
    })
})
