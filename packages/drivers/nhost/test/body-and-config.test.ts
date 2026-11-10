import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { NhostDriver } from '../src/nhost-driver.ts'
import type { NhostConfig } from '../src/types.ts'

const endpoint = 'http://localhost:1337/v1/graphql'

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

const hanging = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason)
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    }),
)

async function failure(config: Partial<NhostConfig>, options?: unknown): Promise<SdkError> {
    const driver = new NhostDriver({ endpoint, ...config }) as unknown as { query: Call }
    return (await driver.query('users', {}, undefined, options).catch(error => error)) as SdkError
}

describe('nhost response body', () => {
    it('keeps the status and says the body is unreadable when onResponse consumed it', async () => {
        const fetch = vi.fn(async () => new Response('{"data":{"users":[]}}', { status: 200 }))
        const error = await failure({ fetch, onResponse: async response => void (await response.text()) })
        expect(error).toBeInstanceOf(SdkError)
        expect(error).toMatchObject({ status: 200, kind: 'network' })
        expect(error.message).toContain('response body unreadable')
    })

    it('keeps the status of a body that is not JSON', async () => {
        const fetch = vi.fn(async () => new Response('<html>', { status: 200 }))
        expect(await failure({ fetch })).toMatchObject({ status: 200, kind: 'network' })
    })
})

describe('nhost timeout and signal config', () => {
    it('times out with the driver timeout', async () => {
        expect(await failure({ fetch: hanging, timeout: 5 })).toMatchObject({ status: 0, kind: 'timeout' })
    })

    it('lets the call timeout win over the driver timeout', async () => {
        const started = Date.now()
        expect(await failure({ fetch: hanging, timeout: 5000 }, { timeout: 5 })).toMatchObject({ kind: 'timeout' })
        expect(Date.now() - started).toBeLessThan(2000)
    })

    it('aborts with the driver signal', async () => {
        const controller = new AbortController()
        controller.abort()
        expect(await failure({ fetch: hanging, signal: controller.signal })).toMatchObject({ status: 0, kind: 'abort' })
    })
})
