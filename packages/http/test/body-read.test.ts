import { describe, expect, it } from 'vitest'
import { HttpError, createRequest, withCallOptions } from '../src/request.ts'
import type { FetchLike } from '../src/index.ts'

const json = (): Response => new Response('{"id":1}', { status: 200, headers: { 'content-type': 'application/json' } })

function slowBody(signal: AbortSignal | null | undefined): Response {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('{"id":'))
            signal?.addEventListener('abort', () => controller.error(signal.reason))
        },
    })
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } })
}

const streaming: FetchLike = async (_input, init) => slowBody(init?.signal)

describe('a body that cannot be read', () => {
    it('keeps the response status and says the body is unreadable', async () => {
        const send = createRequest(async () => json(), { onResponse: async response => void (await response.text()) })
        const error = (await send('http://api.test/a').catch(e => e)) as HttpError
        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(200)
        expect(error.kind).toBe('network')
        expect(error.message).toContain('response body unreadable')
        expect(error.message).not.toContain('<no response>')
        expect(error.cause).toBeInstanceOf(Error)
    })

    it('is an abort when the call signal aborts while the body is read', async () => {
        const controller = new AbortController()
        const send = withCallOptions(createRequest(streaming), { signal: controller.signal })
        const pending = send('http://api.test/a').catch(e => e)
        setTimeout(() => controller.abort(), 10)
        expect(await pending).toMatchObject({ status: 200, kind: 'abort' })
    })

    it('is a timeout when the call timeout elapses while the body is read', async () => {
        const send = withCallOptions(createRequest(streaming), { timeout: 10 })
        expect(await send('http://api.test/a').catch(e => e)).toMatchObject({ status: 200, kind: 'timeout' })
    })

    it('is an abort when the driver signal aborts while the body is read', async () => {
        const controller = new AbortController()
        const send = createRequest(streaming, { signal: controller.signal })
        const pending = send('http://api.test/a').catch(e => e)
        setTimeout(() => controller.abort(), 10)
        expect(await pending).toMatchObject({ status: 200, kind: 'abort' })
    })
})

describe('the call timeout', () => {
    it('covers every request bound by one withCallOptions', async () => {
        let calls = 0
        const delayed: FetchLike = (_input, init) =>
            new Promise((resolve, reject) => {
                calls++
                init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
                setTimeout(() => resolve(json()), 30)
            })
        const send = withCallOptions(createRequest(delayed), { timeout: 75 })
        await send('http://api.test/1')
        await send('http://api.test/2')
        const error = (await send('http://api.test/3').catch(e => e)) as HttpError
        expect(calls).toBe(3)
        expect(error.kind).toBe('timeout')
    })
})
