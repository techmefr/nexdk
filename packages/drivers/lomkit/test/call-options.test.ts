import { HttpError } from '@nexdk/http'
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

describe('lomkit per-call options', () => {
    it('merges the call headers over the driver headers', async () => {
        const { calls, fetch } = backend()
        const { sdk } = makeSdk({ headers: { Authorization: 'Bearer driver', 'X-App': 'a' } }, fetch)
        await sdk.lomkit.users.get({}, undefined, { headers: { Authorization: 'Bearer call' } })
        const headers = new Headers(calls[0].init.headers)
        expect(headers.get('authorization')).toBe('Bearer call')
        expect(headers.get('x-app')).toBe('a')
    })

    it('aborts one call with its signal and keeps the driver usable', async () => {
        const { fetch } = backend()
        const { sdk, events } = makeSdk({}, fetch)
        const controller = new AbortController()
        const pending = sdk.lomkit.users.get({}, undefined, { signal: controller.signal })
        controller.abort()
        const { error } = await pending
        expect(error).toBeInstanceOf(HttpError)
        expect(error).toMatchObject({ status: 0, kind: 'abort' })
        expect(events.find(([event]) => event === 'error')?.[1]).toMatchObject({ status: 0, kind: 'abort' })
        expect((await sdk.lomkit.users.get({})).error).toBeUndefined()
    })

    it('lets the call timeout win over the driver timeout', async () => {
        const { fetch } = backend()
        const { sdk } = makeSdk({ timeout: 1000 }, fetch)
        const { error } = await sdk.lomkit.users.get({}, undefined, { timeout: 5 })
        expect(error).toMatchObject({ status: 0, kind: 'timeout' })
    })

    it('still honours the driver signal next to a call signal', async () => {
        const { fetch } = backend()
        const driver = new AbortController()
        const { sdk } = makeSdk({ signal: driver.signal }, fetch)
        const pending = sdk.lomkit.users.get({}, undefined, { signal: new AbortController().signal })
        driver.abort()
        expect((await pending).error).toMatchObject({ kind: 'abort' })
    })
})
