import { createSdk } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it } from 'vitest'
import { createPocketbaseDriver } from '../src/driver.ts'

type Method = (payload?: unknown, onEvent?: (event: SdkEvent, data?: unknown) => void) => Promise<unknown>

const reply = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const offline = async (): Promise<Response> => {
    throw new TypeError('fetch failed')
}

const calls: Array<[string, unknown, unknown]> = [
    ['get', {}, { items: [], totalPages: 1 }],
    ['find', { id: 'a' }, { id: 'a' }],
    ['create', { name: 'a' }, { id: 'a' }],
    ['update', { id: 'a', name: 'b' }, { id: 'a' }],
    ['remove', { id: 'a' }, {}],
]

function run(fetch: typeof globalThis.fetch, method: string) {
    const global: SdkEvent[] = []
    const local: SdkEvent[] = []
    const sdk = createSdk({
        drivers: { pocketbase: createPocketbaseDriver({ baseUrl: 'http://api.test', fetch }) },
        notify: event => global.push(event),
    }) as unknown as Record<string, Record<string, Record<string, Method>>>
    const call = (payload: unknown) => sdk.pocketbase.users[method](payload, event => local.push(event)).catch(() => undefined)
    return { global, local, call }
}

describe.each(calls)('pocketbase %s', (method, payload, body) => {
    it.each([
        ['success', reply(200, body)],
        ['error', reply(500, { message: 'boom' })],
        ['error', offline],
    ] as const)('emits one request and one %s', async (outcome, fetch) => {
        const { global, local, call } = run(fetch as typeof globalThis.fetch, method)
        await call(payload)
        expect(global).toEqual(['request', outcome])
        expect(local).toEqual(['request', outcome])
    })

    it('emits the resource and the payload with the request', async () => {
        const seen: unknown[] = []
        const driver = createPocketbaseDriver({ baseUrl: 'http://api.test', fetch: reply(200, body) as typeof globalThis.fetch })
        await (driver as unknown as Record<string, (r: string, p: unknown, e: (event: SdkEvent, data?: unknown) => void) => Promise<unknown>>)[method](
            'users',
            payload,
            (event, data) => seen.push([event, data]),
        )
        expect(seen).toEqual([['request', { resource: 'users', payload }], ['success', expect.anything()]])
    })
})
