import { describe, expect, it, vi } from 'vitest'
import { SdkError, createSdk, defineDriver } from '../src/index.ts'

const failure = new SdkError('HTTP 401', { status: 401 })

const driver = () =>
    defineDriver({
        name: 'stub',
        setup: () => ({}),
        methods: {
            ok: async () => ({ id: 1 }),
            fail: () => Promise.reject(failure),
            crash: () => Promise.reject('plain'),
            stream: () => () => undefined,
            sync: () => {
                throw failure
            },
        },
    })({})

type Calls = Record<string, Record<string, (payload?: unknown) => unknown>>

function makeSdk(throwErrors?: true) {
    const notify = vi.fn()
    const onStatus = vi.fn()
    const sdk = createSdk({ drivers: { stub: driver() }, notify, onStatus: { 401: onStatus }, throw: throwErrors }) as unknown as {
        stub: Calls
    }
    return { users: sdk.stub.users, notify, onStatus }
}

describe('result object of createSdk', () => {
    it('resolves { data, error: undefined } on success', async () => {
        expect(await makeSdk().users.ok()).toEqual({ data: { id: 1 }, error: undefined })
    })

    it('resolves the original error and runs notify and onStatus first', async () => {
        const { users, notify, onStatus } = makeSdk()
        const result = await users.fail()
        expect(result).toEqual({ data: undefined, error: failure })
        expect((result as { error: unknown }).error).toBe(failure)
        expect(notify).toHaveBeenCalledWith('error', { message: 'HTTP 401', status: 401, resource: 'users', method: 'fail' })
        expect(onStatus).toHaveBeenCalledTimes(1)
    })

    it('keeps a non Error rejection as the error', async () => {
        expect(await makeSdk().users.crash()).toEqual({ data: undefined, error: 'plain' })
    })

    it('leaves reactive methods and synchronous throws unchanged', () => {
        const { users } = makeSdk()
        expect(typeof users.stream()).toBe('function')
        expect(() => makeSdk(true).users.sync()).toThrow('HTTP 401')
    })

    it('rejects with throw: true', async () => {
        const { users, onStatus } = makeSdk(true)
        await expect(users.fail()).rejects.toBe(failure)
        expect(onStatus).toHaveBeenCalledTimes(1)
        expect(await users.ok()).toEqual({ id: 1 })
    })
})
