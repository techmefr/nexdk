import { createSdk, defineResource } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'

type Method = (payload?: unknown, onEvent?: (event: SdkEvent, data?: unknown) => void) => Promise<unknown>

const reply = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const offline = async (): Promise<Response> => {
    throw new TypeError('fetch failed')
}

const people = defineResource({ name: 'users', schema: z.object({ id: z.number() }) })

const calls: Array<[string, unknown, unknown]> = [
    ['get', { search: { limit: 1 } }, { data: [] }],
    ['mutate', { operation: 'create', attributes: { id: 1 } }, { created: [1], updated: [] }],
    ['delete', { resources: [1] }, {}],
    ['restore', { resources: [1] }, { data: [] }],
    ['forceDelete', { resources: [1] }, { data: [] }],
    ['actions', { name: 'archive' }, { data: { impacted: 1 } }],
    ['details', undefined, { data: {} }],
]

function run(fetch: typeof globalThis.fetch, method: string) {
    const global: Array<[SdkEvent, unknown]> = []
    const local: SdkEvent[] = []
    const sdk = createSdk({
        drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://api.test', fetch }) },
        resources: { lomkit: { people } },
        notify: (event, data) => global.push([event, data]),
    }) as unknown as Record<string, Record<string, Record<string, Method>>>
    const call = (payload: unknown) => sdk.lomkit.people[method](payload, event => local.push(event)).catch(() => undefined)
    return { global, local, call }
}

describe.each(calls)('lomkit %s', (method, payload, body) => {
    it.each([
        ['success', reply(200, body)],
        ['error', reply(500, { message: 'boom' })],
        ['error', reply(422, { message: 'invalid', errors: { 'mutate.0.attributes.id': ['bad'] } })],
        ['error', offline],
    ] as const)('emits one request and one %s', async (outcome, fetch) => {
        const { global, local, call } = run(fetch as typeof globalThis.fetch, method)
        await call(payload)
        expect(global.map(([event]) => event)).toEqual(['request', outcome])
        expect(local).toEqual(['request', outcome])
    })

    it('emits the resolved resource name and the payload with the request', async () => {
        const { global, call } = run(reply(200, body) as typeof globalThis.fetch, method)
        await call(payload)
        expect(global[0]).toEqual(['request', { resource: 'users', payload }])
    })
})
