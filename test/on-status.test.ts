import { describe, expect, it, vi } from 'vitest'
import { createSdk } from '../src/create-sdk.ts'
import { defineDriver } from '../src/define-driver.ts'
import { SdkError } from '../src/errors.ts'
import type { StatusHandlers } from '../src/types.ts'

function failing(status: number) {
    return defineDriver({
        name: 'failing',
        setup: () => ({}),
        methods: {
            get: () => Promise.reject(new SdkError(`HTTP ${status}`, { status, errors: { email: ['bad'] } })),
            syncGet: () => {
                throw new SdkError('HTTP 401', { status: 401 })
            },
            plain: () => Promise.reject(new Error('boom')),
            ok: () => Promise.resolve({ id: 1 }),
            stream: () => () => {},
        },
    })({})
}

function sdkWith(status: number, onStatus: StatusHandlers, notify?: (event: string, data?: unknown) => void) {
    return createSdk({ drivers: { api: failing(status) }, onStatus, notify: notify as never }) as unknown as {
        api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>
    }
}

describe('onStatus', () => {
    it('calls the exact status handler with the error, driver, resource and method', async () => {
        const handler = vi.fn()
        const sdk = sdkWith(401, { 401: handler })
        const error = await sdk.api.users.get().catch(e => e)
        expect(error).toBeInstanceOf(SdkError)
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith({ error, driver: 'failing', resource: 'users', method: 'get' })
    })

    it('falls back to the 4xx and 5xx families', async () => {
        const client = vi.fn()
        const server = vi.fn()
        await sdkWith(404, { '4xx': client, '5xx': server }).api.users.get().catch(() => {})
        await sdkWith(503, { '4xx': client, '5xx': server }).api.users.get().catch(() => {})
        expect(client).toHaveBeenCalledTimes(1)
        expect(client.mock.calls[0][0].error.status).toBe(404)
        expect(server).toHaveBeenCalledTimes(1)
        expect(server.mock.calls[0][0].error.status).toBe(503)
    })

    it('prefers the exact status over the family', async () => {
        const exact = vi.fn()
        const family = vi.fn()
        await sdkWith(403, { 403: exact, '4xx': family }).api.users.get().catch(() => {})
        expect(exact).toHaveBeenCalledTimes(1)
        expect(family).not.toHaveBeenCalled()
    })

    it('ignores statuses without a handler, success, network errors and plain errors', async () => {
        const handler = vi.fn()
        await sdkWith(422, { 401: handler, '5xx': handler }).api.users.get().catch(() => {})
        await sdkWith(0, { '4xx': handler, '5xx': handler }).api.users.get().catch(() => {})
        const sdk = sdkWith(500, { '5xx': handler })
        await sdk.api.users.plain().catch(() => {})
        await sdk.api.users.ok()
        expect(handler).not.toHaveBeenCalled()
    })

    it('runs after notify and once per error', async () => {
        const order: string[] = []
        const handler = vi.fn(() => {
            order.push('status')
        })
        const sdk = createSdk({
            drivers: { api: defineDriver({ name: 'order', setup: () => ({}), methods: {
                get: () => Promise.reject(new SdkError('HTTP 401', { status: 401 })),
            } })({}) },
            notify: event => order.push(`notify:${event}`),
            onStatus: { 401: handler },
        }) as unknown as { api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> }
        await sdk.api.users.get(undefined, event => order.push(`local:${event}`)).catch(() => {})
        expect(order).toEqual(['notify:request', 'local:request', 'notify:error', 'local:error', 'status'])
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('waits for an asynchronous handler and still throws the original error', async () => {
        const finished: string[] = []
        const sdk = sdkWith(401, {
            401: async () => {
                await new Promise(done => setTimeout(done, 10))
                finished.push('handler')
            },
        })
        const error = await sdk.api.users.get().then(
            () => undefined,
            (caught: unknown) => {
                finished.push('caught')
                return caught
            },
        )
        expect(finished).toEqual(['handler', 'caught'])
        expect(error).toBeInstanceOf(SdkError)
        expect((error as SdkError).status).toBe(401)
    })

    it('isolates a handler that throws, synchronously or not', async () => {
        const events: Array<[string, unknown]> = []
        const sync = sdkWith(401, { 401: () => { throw new Error('handler failed') } }, (event, data) => events.push([event, data]))
        const syncError = await sync.api.users.get().catch(e => e)
        expect(syncError).toBeInstanceOf(SdkError)
        expect((syncError as SdkError).message).toBe('HTTP 401')
        expect(events.map(([event]) => event)).toEqual(['request', 'error'])

        const asynchronous = sdkWith(403, { 403: () => Promise.reject(new Error('async handler failed')) })
        const asyncError = await asynchronous.api.users.get().catch(e => e)
        expect(asyncError).toBeInstanceOf(SdkError)
        expect((asyncError as SdkError).status).toBe(403)
    })

    it('reacts to an error thrown synchronously by a driver method', async () => {
        const handler = vi.fn()
        const sdk = sdkWith(401, { 401: handler })
        expect(() => sdk.api.users.syncGet()).toThrow('HTTP 401')
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0][0]).toMatchObject({ driver: 'failing', resource: 'users', method: 'syncGet' })
    })

    it('leaves reactive methods and results untouched', () => {
        const handler = vi.fn()
        const sdk = sdkWith(401, { 401: handler })
        expect(typeof sdk.api.users.stream()).toBe('function')
        expect(handler).not.toHaveBeenCalled()
    })

    it('changes nothing without onStatus', async () => {
        const sdk = createSdk({ drivers: { api: failing(401) } }) as unknown as {
            api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>
        }
        const pending = sdk.api.users.get()
        await expect(pending).rejects.toMatchObject({ status: 401 })
    })
})
