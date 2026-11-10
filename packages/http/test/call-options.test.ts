import { describe, expect, it } from 'vitest'
import { createRequest, withCallOptions } from '../src/request.ts'
import type { HttpError } from '../src/request.ts'
import type { FetchLike } from '../src/index.ts'

function recorder() {
    const calls: RequestInit[] = []
    const fetch: FetchLike = (_input, init) => {
        calls.push(init ?? {})
        return new Promise((resolve, reject) => {
            if (init?.signal?.aborted) return reject(init.signal.reason)
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            setTimeout(() => resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })), 30)
        })
    }
    return { calls, fetch }
}

describe('withCallOptions', () => {
    it('merges call headers over the driver headers, case-insensitively', async () => {
        const { calls, fetch } = recorder()
        const send = withCallOptions(createRequest(fetch), { headers: { authorization: 'Bearer call', 'X-Trace': '1' } })
        await send('http://api.test/a', { headers: { Authorization: 'Bearer driver', Accept: 'application/json' } })
        const headers = new Headers(calls[0].headers)
        expect(headers.get('authorization')).toBe('Bearer call')
        expect(headers.get('x-trace')).toBe('1')
        expect(headers.get('accept')).toBe('application/json')
    })

    it('lets the call timeout win over the driver timeout', async () => {
        const { fetch } = recorder()
        const send = withCallOptions(createRequest(fetch, { timeout: 1000 }), { timeout: 5 })
        const error = (await send('http://api.test/a').catch(e => e)) as HttpError
        expect(error.kind).toBe('timeout')
    })

    it('aborts when the call signal aborts and keeps the driver usable', async () => {
        const { fetch } = recorder()
        const driverSignal = new AbortController().signal
        const base = createRequest(fetch, { signal: driverSignal })
        const controller = new AbortController()
        controller.abort()
        const error = (await withCallOptions(base, { signal: controller.signal })('http://api.test/a').catch(e => e)) as HttpError
        expect(error.kind).toBe('abort')
        await expect(base('http://api.test/b')).resolves.toEqual({})
        await expect(withCallOptions(base, { signal: new AbortController().signal })('http://api.test/c')).resolves.toEqual({})
    })

    it('aborts when the driver signal aborts, whatever the call signal', async () => {
        const { fetch } = recorder()
        const driver = new AbortController()
        const send = withCallOptions(createRequest(fetch, { signal: driver.signal }), { signal: new AbortController().signal })
        const pending = send('http://api.test/a').catch(e => e)
        driver.abort()
        expect(((await pending) as HttpError).kind).toBe('abort')
    })

    it('returns the request untouched without options', () => {
        const base = createRequest()
        expect(withCallOptions(base, undefined)).toBe(base)
    })
})
