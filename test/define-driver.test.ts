import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineDriver, resolveHeaders } from '../src/define-driver.ts'
import { defineResource } from '../src/define-resource.ts'
import type { HeadersResolver } from '../src/define-driver.ts'

const UserSchema = z.object({ id: z.number(), name: z.string() })
const userResource = defineResource({ name: 'users', schema: UserSchema })

interface TestConfig {
    headers?: HeadersResolver
}

interface TestState {
    resolveHeaders: () => Promise<Record<string, string>>
}

function makeTestDriver() {
    return defineDriver<TestConfig, TestState, {
        get: (ctx: TestState & { resourceName: string }, payload: unknown) => Promise<unknown>
        boom: () => Promise<never>
        boomSync: () => never
        getSync: (ctx: { resourceName: string }, payload: unknown) => unknown
        watch: (ctx: { emit?: (event: string, data?: unknown) => void }) => () => void
        headersDump: (ctx: TestState) => Promise<Record<string, string>>
    }>({
        name: 'test',
        setup: config => ({
            resolveHeaders: () => resolveHeaders(config.headers),
        }),
        methods: {
            get: async (ctx, payload) => ({ resource: ctx.resourceName, payload }),
            boom: async () => {
                throw new Error('kaboom')
            },
            boomSync: () => {
                throw new Error('sync kaboom')
            },
            getSync: (ctx, payload) => ({ resource: ctx.resourceName, payload }),
            watch: ctx => {
                ctx.emit?.('connected')
                return () => ctx.emit?.('disconnected')
            },
            headersDump: async ctx => ctx.resolveHeaders(),
        },
    })
}

describe('resolveHeaders', () => {
    it('returns a static object headers config untouched', async () => {
        const headers = await resolveHeaders({ Authorization: 'Bearer static' })
        expect(headers).toEqual({ Authorization: 'Bearer static' })
    })

    it('returns an empty object when headers is undefined', async () => {
        const headers = await resolveHeaders(undefined)
        expect(headers).toEqual({})
    })

    it('awaits a function-form headers config', async () => {
        const headers = await resolveHeaders(() => ({ Authorization: 'Bearer fn' }))
        expect(headers).toEqual({ Authorization: 'Bearer fn' })
    })
})

describe('defineDriver', () => {
    it('builds a SdkDriver with name, bindResource and one function per method', () => {
        const driver = makeTestDriver()({})
        expect(driver.name).toBe('test')
        expect(typeof driver.bindResource).toBe('function')
        expect(typeof (driver as Record<string, unknown>).get).toBe('function')
        expect(typeof (driver as Record<string, unknown>).watch).toBe('function')
    })

    it('binds a resource and exposes it on the method ctx', async () => {
        const driver = makeTestDriver()({})
        driver.bindResource('users', userResource)
        // The bound resource flows through: the get method echoes the resource key.
        const result = await (driver as unknown as {
            get: (r: string, p?: unknown) => Promise<{ resource: string }>
        }).get('users', { id: 1 })
        expect(result.resource).toBe('users')
    })

    it('emits request then success around a normal method', async () => {
        const driver = makeTestDriver()({})
        const events: string[] = []
        await (driver as unknown as {
            get: (r: string, p: unknown, e: (event: string) => void) => Promise<unknown>
        }).get('users', { id: 1 }, event => events.push(event))
        expect(events).toEqual(['request', 'success'])
    })

    it('turns an author throw into emit(error) + rethrow', async () => {
        const driver = makeTestDriver()({})
        const events: Array<[string, unknown]> = []
        await expect(
            (driver as unknown as {
                boom: (r: string, p: unknown, e: (event: string, data?: unknown) => void) => Promise<never>
            }).boom('users', undefined, (event, data) => events.push([event, data])),
        ).rejects.toThrow('kaboom')
        expect(events[0][0]).toBe('request')
        expect(events[1]).toEqual(['error', { message: 'kaboom' }])
    })

    it('turns a synchronous author throw into emit(error) + rethrow', () => {
        const driver = makeTestDriver()({})
        const events: Array<[string, unknown]> = []
        expect(() =>
            (driver as unknown as {
                boomSync: (r: string, p: unknown, e: (event: string, data?: unknown) => void) => never
            }).boomSync('users', undefined, (event, data) => events.push([event, data])),
        ).toThrow('sync kaboom')
        expect(events[0][0]).toBe('request')
        expect(events[1]).toEqual(['error', { message: 'sync kaboom' }])
    })

    it('emits request then success around a synchronous (non-Promise) method result', () => {
        const driver = makeTestDriver()({})
        const events: string[] = []
        const result = (driver as unknown as {
            getSync: (r: string, p: unknown, e: (event: string) => void) => { resource: string }
        }).getSync('users', { id: 1 }, event => events.push(event))
        expect(result).toEqual({ resource: 'users', payload: { id: 1 } })
        expect(events).toEqual(['request', 'success'])
    })

    it('returns a reactive method unsubscribe untouched (no success envelope)', () => {
        const driver = makeTestDriver()({})
        const events: string[] = []
        const unsubscribe = (driver as unknown as {
            watch: (r: string, p: unknown, e: (event: string) => void) => () => void
        }).watch('users', undefined, event => events.push(event))

        // No 'success' around a reactive method; connected fired inside the body.
        expect(events).toEqual(['request', 'connected'])
        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
        expect(events).toEqual(['request', 'connected', 'disconnected'])
    })

    it('awaits an async header resolver supplied via setup', async () => {
        const driver = makeTestDriver()({
            headers: async () => {
                await Promise.resolve()
                return { Authorization: 'Bearer refreshed' }
            },
        })
        const headers = await (driver as unknown as {
            headersDump: (r: string) => Promise<Record<string, string>>
        }).headersDump('users')
        expect(headers.Authorization).toBe('Bearer refreshed')
    })
})

describe('defineDriver error event payload', () => {
    class FakeHttpError extends Error {
        readonly status: number
        readonly data: unknown
        constructor(status: number, data: unknown) {
            super('HTTP ' + status)
            this.name = 'HttpError'
            this.status = status
            this.data = data
        }
    }

    function makeThrower(thrown: unknown) {
        return defineDriver<Record<string, never>, Record<string, never>, {
            fail: () => Promise<never>
            failSync: () => never
        }>({
            name: 'thrower',
            setup: () => ({}),
            methods: {
                fail: async () => { throw thrown },
                failSync: () => { throw thrown },
            },
        })({}) as unknown as Record<string, (...args: unknown[]) => unknown>
    }

    it('emits status and errors for an HttpError', async () => {
        const events: Array<[string, unknown?]> = []
        const driver = makeThrower(new FakeHttpError(422, { message: 'bad' }))
        await expect(driver.fail('users', undefined, (e: string, d?: unknown) => events.push([e, d]))).rejects.toThrow('HTTP 422')
        expect(events[1]).toEqual(['error', { message: 'HTTP 422', status: 422, errors: { message: 'bad' } }])
    })

    it('emits status and errors for a synchronous HttpError', () => {
        const events: Array<[string, unknown?]> = []
        const driver = makeThrower(new FakeHttpError(500, null))
        expect(() => driver.failSync('users', undefined, (e: string, d?: unknown) => events.push([e, d]))).toThrow('HTTP 500')
        expect(events[1]).toEqual(['error', { message: 'HTTP 500', status: 500, errors: null }])
    })

    it('normalizes a non-Error throw with String()', async () => {
        const events: Array<[string, unknown?]> = []
        const driver = makeThrower('plain failure')
        await expect(driver.fail('users', undefined, (e: string, d?: unknown) => events.push([e, d]))).rejects.toBe('plain failure')
        expect(events[1]).toEqual(['error', { message: 'plain failure' }])
    })

    it('normalizes a non-Error object throw without crashing', () => {
        const events: Array<[string, unknown?]> = []
        const driver = makeThrower(undefined)
        expect(() => driver.failSync('users', undefined, (e: string, d?: unknown) => events.push([e, d]))).toThrow()
        expect(events[1]).toEqual(['error', { message: 'undefined' }])
    })
})
