import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createSdk, defineDriver, defineResource } from '../src/index.ts'
import type { SdkEvent } from '../src/index.ts'

type Method = (payload?: unknown, onEvent?: (event: SdkEvent, data?: unknown) => void) => Promise<unknown>

function makeSdk(answer: unknown, validateResponses: boolean) {
    const events: Array<[SdkEvent, unknown]> = []
    const local: SdkEvent[] = []
    const driver = defineDriver({ name: 'stub', setup: () => ({}), methods: { find: async () => answer } })({})
    const sdk = createSdk({
        drivers: { stub: driver },
        resources: { stub: { users: defineResource({ name: 'users', schema: z.object({ id: z.number() }) }) } },
        validateResponses,
        notify: (event, data) => events.push([event, data]),
    }) as unknown as { stub: { users: { find: Method } } }
    const find = () => sdk.stub.users.find({ id: 1 }, event => local.push(event)).catch(() => undefined)
    return { events, local, find }
}

describe('events emitted once per call', () => {
    it('emits request then success once without validation', async () => {
        const { events, local, find } = makeSdk({ id: 1 }, false)
        await find()
        expect(events).toEqual([['request', { resource: 'users', payload: { id: 1 } }], ['success', { id: 1 }]])
        expect(local).toEqual(['request', 'success'])
    })

    it('emits success once, after a passing validation', async () => {
        const { events, local, find } = makeSdk({ id: 1 }, true)
        await find()
        expect(events.map(([event]) => event)).toEqual(['request', 'success'])
        expect(local).toEqual(['request', 'success'])
    })

    it('emits error and no success when the validation fails', async () => {
        const { events, local, find } = makeSdk({ id: 'x' }, true)
        await find()
        expect(events.map(([event]) => event)).toEqual(['request', 'error'])
        expect(events[1][1]).toMatchObject({ status: 0, errors: { id: [expect.any(String)] } })
        expect(local).toEqual(['request', 'error'])
    })
})
