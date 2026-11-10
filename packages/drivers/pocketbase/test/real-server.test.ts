import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { createPocketbaseDriver } from '../src/driver.ts'

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

type Call = (resource: string, payload?: unknown, onEvent?: (event: string, data?: unknown) => void) => Promise<unknown>

function makeDriver(fetchImpl: typeof fetch) {
    const driver = createPocketbaseDriver({ baseUrl: 'http://localhost:8090', fetch: fetchImpl })
    return driver as unknown as { get: Call; create: Call }
}

const asFetch = (mock: ReturnType<typeof vi.fn>) => mock as unknown as typeof fetch

const pageOf = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: `r${start + i}` }))

describe('pocketbase validation errors', () => {
    const body = {
        status: 400,
        message: 'Failed to create record.',
        data: {
            name: { code: 'validation_required', message: 'Cannot be blank.' },
            email: { code: 'validation_is_email', message: 'Must be a valid email address.' },
        },
    }

    it('maps data.<field>.message to errors.<field> and keeps the body in data', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(400, body))

        const error = (await makeDriver(asFetch(injected))
            .create('users', { email: 'a@b.test' })
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(400)
        expect(error.message).toBe('Failed to create record.')
        expect(error.errors).toEqual({ name: ['Cannot be blank.'], email: ['Must be a valid email address.'] })
        expect(error.data).toEqual(body)
    })

    it('puts the mapped field errors in the error event payload', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(400, body))
        const events: Array<[string, unknown]> = []

        await makeDriver(asFetch(injected))
            .create('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)

        expect(events.filter(([event]) => event === 'error')).toEqual([
            [
                'error',
                {
                    message: 'Failed to create record.',
                    status: 400,
                    errors: { name: ['Cannot be blank.'], email: ['Must be a valid email address.'] },
                    kind: 'http',
                },
            ],
        ])
    })

    it('keeps the plain message of a validation error that has field errors', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(400, body))

        const error = (await makeDriver(asFetch(injected)).create('users', {}).catch(e => e)) as SdkError

        expect(error.message).not.toContain('rejected the request')
    })
})

describe('pocketbase opaque query rejections', () => {
    const opaque = { status: 400, message: 'Something went wrong while processing your request.', data: {} }

    it('prefixes a 400 without field errors and invents no detail', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(400, opaque))

        const error = (await makeDriver(asFetch(injected))
            .get('users', { filter: 'nope = 1' })
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(400)
        expect(error.message).toBe(`PocketBase rejected the request: ${opaque.message}`)
        expect(error.data).toEqual(opaque)
        expect(error.errors).toBeUndefined()
    })

    it('carries the prefixed message in the error event', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(400, opaque))
        const events: Array<[string, unknown]> = []

        await makeDriver(asFetch(injected))
            .get('users', { sort: 'nope' }, (event, data) => events.push([event, data]))
            .catch(e => e)

        const error = events.find(([event]) => event === 'error')?.[1] as { message: string; status: number }
        expect(error.status).toBe(400)
        expect(error.message).toBe(`PocketBase rejected the request: ${opaque.message}`)
    })

    it('leaves a 404 untouched', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(404, { status: 404, message: "The requested resource wasn't found.", data: {} }))

        const error = (await makeDriver(asFetch(injected)).get('users', {}).catch(e => e)) as SdkError

        expect(error.status).toBe(404)
        expect(error.message).toBe("The requested resource wasn't found.")
    })
})

describe('pocketbase pagination without totalPages', () => {
    it('keeps requesting pages while they are full when totalPages is -1', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { page: 1, perPage: 30, totalPages: -1, items: pageOf(1, 30) }))
            .mockResolvedValueOnce(jsonResponse(200, { page: 2, perPage: 30, totalPages: -1, items: pageOf(31, 30) }))
            .mockResolvedValueOnce(jsonResponse(200, { page: 3, perPage: 30, totalPages: -1, items: pageOf(61, 7) }))

        const items = (await makeDriver(asFetch(injected)).get('users', { skipTotal: 1 })) as unknown[]

        expect(items).toHaveLength(67)
        expect(injected).toHaveBeenCalledTimes(3)
        expect(String(injected.mock.calls[1]![0])).toContain('page=2')
        expect(String(injected.mock.calls[2]![0])).toContain('page=3')
    })

    it('stops on an empty page after a full one', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { page: 1, perPage: 30, totalPages: -1, items: pageOf(1, 30) }))
            .mockResolvedValueOnce(jsonResponse(200, { page: 2, perPage: 30, totalPages: -1, items: [] }))

        const items = (await makeDriver(asFetch(injected)).get('users', { skipTotal: 1 })) as unknown[]

        expect(items).toHaveLength(30)
        expect(injected).toHaveBeenCalledTimes(2)
    })

    it('makes a single request when the first page is not full', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { page: 1, perPage: 30, totalPages: -1, items: pageOf(1, 5) }))

        const items = (await makeDriver(asFetch(injected)).get('users', { skipTotal: 1 })) as unknown[]

        expect(items).toHaveLength(5)
        expect(injected).toHaveBeenCalledTimes(1)
    })

    it('still follows totalPages when the server reports it', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { page: 1, perPage: 30, totalPages: 2, items: pageOf(1, 30) }))
            .mockResolvedValueOnce(jsonResponse(200, { page: 2, perPage: 30, totalPages: 2, items: pageOf(31, 3) }))

        const items = (await makeDriver(asFetch(injected)).get('users', {})) as unknown[]

        expect(items).toHaveLength(33)
        expect(injected).toHaveBeenCalledTimes(2)
    })
})

describe('pocketbase get with page or perPage', () => {
    it('returns the single page the caller asked for, even without perPage', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { page: 2, perPage: 30, totalPages: 3, items: pageOf(31, 30) }))

        const items = (await makeDriver(asFetch(injected)).get('users', { page: 2 })) as unknown[]

        expect(items).toHaveLength(30)
        expect(injected).toHaveBeenCalledTimes(1)
    })
})
