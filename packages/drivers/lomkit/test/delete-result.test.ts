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

describe('lomkit delete', () => {
    it('resolves the rows the server answers', async () => {
        const deleted = { data: [{ id: 1, name: 'Ann' }], meta: { gates: {} } }
        const { fetch } = backend(200, deleted)
        const { sdk } = makeSdk({}, fetch)
        const { data } = await sdk.lomkit.users.delete({ resources: [1] })
        expect(data).toEqual(deleted)
        expect(data?.data[0].name).toBe('Ann')
    })
})
