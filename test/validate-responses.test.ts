import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ResponseValidationError, SdkError, createSdk, defineDriver, defineResource } from '../src/index.ts'
import type { SdkEventHandler } from '../src/index.ts'

const UserSchema = z.object({ id: z.number(), name: z.string() })

type Answers = Record<string, unknown>

function makeSdk(answers: Answers, options: { global?: boolean; resource?: boolean; notify?: SdkEventHandler } = {}) {
    const answer = (name: string) => async () => answers[name]
    const driver = defineDriver({
        name: 'stub',
        setup: () => ({}),
        methods: {
            get: answer('get'),
            find: answer('find'),
            create: answer('create'),
            update: answer('update'),
            remove: answer('remove'),
            mutate: answer('mutate'),
        },
    })({})
    const users = defineResource({ name: 'users', schema: UserSchema, validateResponses: options.resource })
    return createSdk({
        drivers: { stub: driver },
        resources: { stub: { users } },
        validateResponses: options.global,
        notify: options.notify,
        throw: true,
    }) as unknown as { stub: { users: Record<string, (...args: unknown[]) => Promise<unknown>> } }
}

describe('response validation is off by default', () => {
    it('returns an invalid answer untouched', async () => {
        const bad = [{ id: 'x' }]
        const sdk = makeSdk({ get: bad })

        expect(await sdk.stub.users.get!()).toBe(bad)
    })

    it('stays off when the resource says false and the sdk says true', async () => {
        const sdk = makeSdk({ find: { id: 'x' } }, { global: true, resource: false })

        expect(await sdk.stub.users.find!()).toEqual({ id: 'x' })
    })
})

describe('response validation enabled', () => {
    it('accepts valid rows, a valid record and keeps non enumerable properties', async () => {
        const rows = Object.defineProperty([{ id: 1, name: 'a' }], 'pagination', { value: { totalItems: 9 }, enumerable: false })
        const sdk = makeSdk({ get: rows, find: { id: 1, name: 'a' } }, { global: true })

        const list = (await sdk.stub.users.get!()) as typeof rows & { pagination: unknown }

        expect(list).toEqual([{ id: 1, name: 'a' }])
        expect(list.pagination).toEqual({ totalItems: 9 })
        expect(await sdk.stub.users.find!()).toEqual({ id: 1, name: 'a' })
    })

    it('rejects an invalid row with a ResponseValidationError of status 0 and indexed errors', async () => {
        const sdk = makeSdk({ get: [{ id: 1, name: 'a' }, { id: 'x', name: 3 }] }, { global: true })

        const error = (await sdk.stub.users.get!().catch(e => e)) as ResponseValidationError

        expect(error).toBeInstanceOf(ResponseValidationError)
        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(0)
        expect(error.message).toBe('Response does not match the schema of resource "users"')
        expect(Object.keys(error.errors as object).sort()).toEqual(['1.id', '1.name'])
        expect((error.errors as Record<string, string[]>)['1.id']).toHaveLength(1)
        expect(error.data).toEqual([{ id: 1, name: 'a' }, { id: 'x', name: 3 }])
    })

    it('validates the rows of a data envelope and keeps the other fields', async () => {
        const ok = makeSdk({ get: { data: [{ id: 1, name: 'a' }], total: 1 } }, { global: true })
        expect(await ok.stub.users.get!()).toEqual({ data: [{ id: 1, name: 'a' }], total: 1 })

        const ko = makeSdk({ get: { data: [{ id: 1 }], total: 1 } }, { global: true })
        const error = (await ko.stub.users.get!().catch(e => e)) as ResponseValidationError
        expect(Object.keys(error.errors as object)).toEqual(['data.0.name'])
    })

    it('uses _ for a root issue', async () => {
        const sdk = makeSdk({ find: 'nope' }, { global: true })

        const error = (await sdk.stub.users.find!().catch(e => e)) as ResponseValidationError

        expect(Object.keys(error.errors as object)).toEqual(['_'])
    })

    it('validates create and update but not remove or other methods', async () => {
        const sdk = makeSdk(
            { create: { id: 'x' }, update: { id: 'x' }, remove: { success: true }, mutate: { created: [1] } },
            { global: true },
        )

        await expect(sdk.stub.users.create!()).rejects.toBeInstanceOf(ResponseValidationError)
        await expect(sdk.stub.users.update!()).rejects.toBeInstanceOf(ResponseValidationError)
        expect(await sdk.stub.users.remove!()).toEqual({ success: true })
        expect(await sdk.stub.users.mutate!()).toEqual({ created: [1] })
    })

    it('can be enabled for a single resource', async () => {
        const sdk = makeSdk({ find: { id: 'x' } }, { resource: true })

        await expect(sdk.stub.users.find!()).rejects.toBeInstanceOf(ResponseValidationError)
    })

    it('emits an error event with status 0 and the field errors', async () => {
        const notify = vi.fn()
        const sdk = makeSdk({ find: { id: 'x', name: 'a' } }, { global: true, notify })

        await sdk.stub.users.find!().catch(() => undefined)

        expect(notify).toHaveBeenCalledWith('error', {
            message: 'Response does not match the schema of resource "users"',
            status: 0,
            errors: { id: [expect.any(String)] },
            resource: 'users',
            method: 'find',
        })
    })

    it('returns the schema output when the validator transforms', async () => {
        const schema = z.object({ id: z.coerce.number() })
        const driver = defineDriver({ name: 'stub', setup: () => ({}), methods: { find: async () => ({ id: '4' }) } })({})
        const sdk = createSdk({
            drivers: { stub: driver },
            resources: { stub: { users: defineResource({ name: 'users', schema }) } },
            validateResponses: true,
            throw: true,
        }) as unknown as { stub: { users: { find: () => Promise<unknown> } } }

        expect(await sdk.stub.users.find()).toEqual({ id: 4 })
    })
})
