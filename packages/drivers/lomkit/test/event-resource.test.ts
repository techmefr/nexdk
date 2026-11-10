import { createSdk, defineResource } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'

const people = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const reply = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function resources(fetch: () => Promise<Response>): Promise<string[]> {
    const notify = vi.fn((_event: SdkEvent, _data?: unknown) => undefined)
    const sdk = createSdk({
        drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://api.test', fetch: fetch as typeof globalThis.fetch }) },
        resources: { lomkit: { people } },
        notify,
        validateResponses: true,
    })
    return sdk.lomkit.people.get().then(() =>
        notify.mock.calls.map(([event, data]) => `${event}:${(data as { resource?: string }).resource}`),
    )
}

describe('the resource of the events of one call', () => {
    it('is the resolved resource name for request and a driver error', async () => {
        expect(await resources(reply(500, { message: 'down' }))).toEqual(['request:users', 'error:users'])
    })

    it('is the resolved resource name for request and a core validation error', async () => {
        expect(await resources(reply(200, { data: [{ id: 'x' }] }))).toEqual(['request:users', 'error:users'])
    })

    it('is the resolved resource name for request and success', async () => {
        expect(await resources(reply(200, { data: [{ id: 1, name: 'Ann' }] }))).toEqual(['request:users', 'success:users'])
    })
})
