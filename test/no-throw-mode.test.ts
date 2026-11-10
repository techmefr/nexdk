import { describe, expect, it, vi } from 'vitest'
import { SdkError, createSdk, defineDriver } from '../src/index.ts'
import type { AnyResource, SdkDriver, SdkEvent } from '../src/index.ts'

const failure = new SdkError('HTTP 401', { status: 401 })

class SilentThrower implements SdkDriver {
    readonly name = 'silent'

    bindResource(_name: string, _resource: AnyResource): void {}

    explode(): never {
        throw failure
    }
}

type Calls = Record<string, Record<string, (payload?: unknown) => unknown>>

function makeSdk(driver: SdkDriver, throwErrors?: true) {
    const events: Array<[SdkEvent, unknown]> = []
    const onStatus = vi.fn()
    const sdk = createSdk({
        drivers: { main: driver },
        notify: (event, data) => events.push([event, data]),
        onStatus: { 401: onStatus },
        throw: throwErrors,
    }) as unknown as { main: Calls }
    return { users: sdk.main.users, events, onStatus }
}

const stub = () => defineDriver({ name: 'stub', setup: () => ({}), methods: { sync: () => { throw failure } } })({})

describe('no exception in { data, error } mode', () => {
    it('resolves an unknown method as { data: undefined, error } and notifies it', async () => {
        const { users, events } = makeSdk(new SilentThrower())
        const result = (await users.search()) as { data: unknown; error: Error }
        expect(result.data).toBeUndefined()
        expect(result.error.message).toBe('Driver "silent" has no method "search" for resource "users"')
        expect(events).toEqual([['error', { message: result.error.message, resource: 'users', method: 'search' }]])
    })

    it('still throws an unknown method with throw: true', () => {
        const { users, events } = makeSdk(new SilentThrower(), true)
        expect(() => users.search()).toThrow('has no method "search"')
        expect(events).toEqual([])
    })

    it('resolves a synchronous driver throw and runs notify and onStatus once', async () => {
        const { users, events, onStatus } = makeSdk(stub())
        const result = users.sync()
        expect(result).toBeInstanceOf(Promise)
        expect(await result).toEqual({ data: undefined, error: failure })
        expect(events.map(([event]) => event)).toEqual(['request', 'error'])
        expect(onStatus).toHaveBeenCalledTimes(1)
    })

    it('notifies a synchronous throw the driver did not emit', async () => {
        const { users, events, onStatus } = makeSdk(new SilentThrower())
        expect(await users.explode()).toEqual({ data: undefined, error: failure })
        expect(events).toEqual([['error', { message: 'HTTP 401', status: 401, resource: 'users', method: 'explode' }]])
        expect(onStatus).toHaveBeenCalledTimes(1)
    })

    it('keeps the synchronous throw with throw: true', () => {
        const { users, events } = makeSdk(new SilentThrower(), true)
        expect(() => users.explode()).toThrow('HTTP 401')
        expect(events).toEqual([])
    })
})
