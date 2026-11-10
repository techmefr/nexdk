import { HttpError } from '@nexdk/http'
import { ResponseValidationError, createSdk, defineResource } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const reply = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const offline = async (): Promise<Response> => {
    throw new TypeError('fetch failed')
}

function makeSdk(fetch: () => Promise<Response>, options: { throw?: true; validateResponses?: boolean } = {}) {
    const order: string[] = []
    const notify = vi.fn((event: SdkEvent) => {
        order.push(`notify:${event}`)
    })
    const onStatus = vi.fn(() => {
        order.push('status')
    })
    const sdk = createSdk({
        drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://api.test', fetch: fetch as typeof globalThis.fetch }) },
        resources: { lomkit: { users } },
        notify,
        onStatus: { '4xx': onStatus, '5xx': onStatus },
        validateResponses: options.validateResponses,
        throw: options.throw,
    })
    return { sdk, notify, onStatus, order }
}

describe('a call resolves { data, error } by default', () => {
    it('resolves the data and no error on success', async () => {
        const { sdk, notify } = makeSdk(reply(200, { data: [{ id: 1, name: 'Ann' }], total: 1 }))
        const result = await sdk.lomkit.users.get({ search: { limit: 1 } })
        expect(result).toEqual({ data: { data: [{ id: 1, name: 'Ann' }], total: 1 }, error: undefined })
        expect(notify.mock.calls.map(([event]) => event)).toEqual(['request', 'success'])
    })

    it('resolves the HttpError with its status, errors and data on an HTTP error', async () => {
        const body = { message: 'invalid', errors: { 'mutate.0.attributes.name': ['required'] } }
        const { sdk, notify, onStatus, order } = makeSdk(reply(422, body))
        const { data, error } = await sdk.lomkit.users.mutate({ operation: 'create', attributes: {} })
        expect(data).toBeUndefined()
        expect(error).toBeInstanceOf(HttpError)
        expect(error).toMatchObject({ status: 422, errors: { name: ['required'] }, data: body })
        expect(notify).toHaveBeenCalledWith('error', { message: 'invalid', status: 422, errors: { name: ['required'] }, kind: 'http' })
        expect(onStatus).toHaveBeenCalledTimes(1)
        expect(order).toEqual(['notify:request', 'notify:error', 'status'])
    })

    it('resolves an HttpError of status 0 on a network error', async () => {
        const { sdk, notify, onStatus } = makeSdk(offline)
        const { data, error } = await sdk.lomkit.users.get()
        expect(data).toBeUndefined()
        expect(error).toBeInstanceOf(HttpError)
        expect(error?.status).toBe(0)
        expect(notify.mock.calls.map(([event]) => event)).toEqual(['request', 'error'])
        expect(onStatus).not.toHaveBeenCalled()
    })

    it('resolves the ResponseValidationError when the response does not match the schema', async () => {
        const { sdk, notify } = makeSdk(reply(200, { data: [{ id: 'x' }] }), { validateResponses: true })
        const { data, error } = await sdk.lomkit.users.get()
        expect(data).toBeUndefined()
        expect(error).toBeInstanceOf(ResponseValidationError)
        expect(error?.status).toBe(0)
        expect(notify.mock.calls.map(([event]) => event)).toEqual(['request', 'error'])
    })

    it('calls notify and onStatus before the call resolves', async () => {
        const { sdk, order } = makeSdk(reply(500, { message: 'down' }))
        await sdk.lomkit.users.get().then(() => order.push('resolved'))
        expect(order).toEqual(['notify:request', 'notify:error', 'status', 'resolved'])
    })
})

describe('throw: true', () => {
    it('resolves the bare data on success', async () => {
        const { sdk } = makeSdk(reply(200, { data: [] }), { throw: true })
        expect(await sdk.lomkit.users.get()).toEqual({ data: [] })
    })

    it('rejects with the original error after notify and onStatus', async () => {
        const { sdk, order } = makeSdk(reply(403, { message: 'This action is unauthorized.' }), { throw: true })
        const error = await sdk.lomkit.users.get().catch((caught: unknown) => {
            order.push('rejected')
            return caught
        })
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).status).toBe(403)
        expect(order).toEqual(['notify:request', 'notify:error', 'status', 'rejected'])
    })

    it('rejects on a network error and on a validation error', async () => {
        await expect(makeSdk(offline, { throw: true }).sdk.lomkit.users.get()).rejects.toMatchObject({ status: 0 })
        const invalid = makeSdk(reply(200, { data: [{ id: 'x' }] }), { throw: true, validateResponses: true })
        await expect(invalid.sdk.lomkit.users.get()).rejects.toBeInstanceOf(ResponseValidationError)
    })
})

describe('direct driver calls', () => {
    it('still reject without createSdk', async () => {
        const driver = new LomkitDriver({ baseUrl: 'http://api.test', fetch: reply(404, { message: 'missing' }) as typeof globalThis.fetch })
        await expect(driver.get('users')).rejects.toBeInstanceOf(HttpError)
    })
})
