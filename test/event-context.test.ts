import { describe, expect, it } from 'vitest'
import { SdkError, createSdk, defineDriver, traceCall } from '../src/index.ts'
import type { SdkEvent } from '../src/index.ts'

describe('event context', () => {
    it('adds resource and method to request, success and error', async () => {
        const events: Array<[SdkEvent, unknown]> = []
        const driver = defineDriver({
            name: 'stub',
            setup: () => ({}),
            methods: {
                ok: async () => ({ id: 1 }),
                ko: async () => {
                    throw new SdkError('Gone', { status: 410, kind: 'http' })
                },
            },
        })({})
        const sdk = createSdk({ drivers: { stub: driver }, notify: (event, data) => events.push([event, data]) }) as unknown as {
            stub: Record<string, Record<string, (payload?: unknown) => Promise<unknown>>>
        }

        await sdk.stub.users.ok({ q: 1 })
        await sdk.stub.posts.ko()

        expect(events).toEqual([
            ['request', { resource: 'users', method: 'ok', payload: { q: 1 } }],
            ['success', { resource: 'users', method: 'ok', data: { id: 1 } }],
            ['request', { resource: 'posts', method: 'ko', payload: undefined }],
            ['error', { message: 'Gone', status: 410, kind: 'http', resource: 'posts', method: 'ko' }],
        ])
    })

    it('reuses the resource of the request for an error the core emits', async () => {
        const events: Array<[SdkEvent, unknown]> = []
        const driver = {
            name: 'hand',
            fail(_resource: string, payload: unknown, onEvent?: (event: SdkEvent, data?: unknown) => void) {
                onEvent?.('request', { resource: 'mapped_users', method: 'fail', payload })
                throw new SdkError('Broken')
            },
        }
        const sdk = createSdk({ drivers: { hand: driver }, notify: (event, data) => events.push([event, data]) }) as unknown as {
            hand: Record<string, Record<string, (payload?: unknown) => Promise<unknown>>>
        }

        await sdk.hand.users.fail(1)

        expect(events).toEqual([
            ['request', { resource: 'mapped_users', method: 'fail', payload: 1 }],
            ['error', { message: 'Broken', resource: 'mapped_users', method: 'fail' }],
        ])
    })

    it('omits method when a hand-written driver does not give it', () => {
        const events: unknown[] = []
        traceCall({ emit: (_event, data) => events.push(data), resource: 'users', payload: 1 }, () => 2)
        expect(events).toEqual([{ resource: 'users', payload: 1 }, { resource: 'users', data: 2 }])
        expect(Object.keys(events[0] as object)).not.toContain('method')
    })
})
