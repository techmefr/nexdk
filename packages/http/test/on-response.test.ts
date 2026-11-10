import { describe, expect, it, vi } from 'vitest'
import { createRequest } from '../src/request.ts'

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('onResponse', () => {
    it('sees every response before parsing, success and error alike', async () => {
        const seen: Array<[number, string, string, string | null]> = []
        const onResponse = vi.fn((response: Response, info: { url: string; method: string }) => {
            seen.push([response.status, info.url, info.method, response.headers.get('x-token')])
        })
        const answers = [json(200, { ok: true }), json(422, { message: 'bad' })]
        answers.forEach(answer => answer.headers.set('x-token', 'fresh'))
        const send = createRequest(async () => answers.shift() as Response, { onResponse })

        expect(await send('http://api.test/a', { method: 'post' })).toEqual({ ok: true })
        await expect(send('http://api.test/b')).rejects.toMatchObject({ status: 422 })
        expect(seen).toEqual([
            [200, 'http://api.test/a', 'POST', 'fresh'],
            [422, 'http://api.test/b', 'GET', 'fresh'],
        ])
    })

    it('awaits an async hook before parsing', async () => {
        const order: string[] = []
        const send = createRequest(async () => json(200, 1), {
            onResponse: async () => {
                await Promise.resolve()
                order.push('hook')
            },
        })
        await send('http://api.test/a').then(() => order.push('parsed'))
        expect(order).toEqual(['hook', 'parsed'])
    })

    it('turns a hook exception into the error of the call', async () => {
        const failure = new Error('refresh failed')
        const send = createRequest(async () => json(200, {}), {
            onResponse: () => {
                throw failure
            },
        })
        await expect(send('http://api.test/a')).rejects.toBe(failure)
    })
})
