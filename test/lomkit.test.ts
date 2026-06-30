import { defineResource } from '@pilota/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'

const UserSchema = z.object({ id: z.number(), name: z.string(), email: z.string() })
const userResource = defineResource({ name: 'users', schema: UserSchema })

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function makeDriver() {
    const driver = new LomkitDriver({ baseUrl: 'http://localhost:8000/api' })
    driver.bindResource('users', userResource)
    return driver
}

describe('LomkitDriver.get', () => {
    it('posts to /resource/search and returns typed data', async () => {
        const payload = [{ id: 1, name: 'Alice', email: 'alice@test.com' }]
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: payload }),
        })

        const driver = makeDriver()
        const result = await driver.get('users', { id: 1 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/search',
            expect.objectContaining({ method: 'POST' }),
        )
        expect(result.data).toEqual(payload)
    })

    it('returns mock directly without network call', async () => {
        const driver = makeDriver()
        const mock = { id: 99, name: 'Mock', email: 'mock@test.com' }

        const result = await driver.get('users', {}, undefined, mock)

        expect(mockFetch).not.toHaveBeenCalled()
        expect(result.data[0]).toEqual(mock)
    })

    it('returns all elements when mock is an array', async () => {
        const driver = makeDriver()
        const mock = [
            { id: 1, name: 'Alice', email: 'alice@test.com' },
            { id: 2, name: 'Bob', email: 'bob@test.com' },
            { id: 3, name: 'Carol', email: 'carol@test.com' },
        ]

        const result = await driver.get('users', {}, undefined, mock)

        expect(mockFetch).not.toHaveBeenCalled()
        expect(result.data).toEqual(mock)
        expect(result.data).toHaveLength(3)
    })

    it('emits request and success events', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [] }),
        })

        const driver = makeDriver()
        const events: string[] = []
        await driver.get('users', {}, event => events.push(event))

        expect(events).toContain('request')
        expect(events).toContain('success')
    })
})

describe('LomkitDriver.mutate', () => {
    it('posts to /resource/mutate', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ id: 1, name: 'Alice', email: 'alice@test.com' }] }),
        })

        const driver = makeDriver()
        await driver.mutate('users', { name: 'Alice', email: 'alice@test.com' })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/mutate',
            expect.objectContaining({ method: 'POST' }),
        )
    })

    it('emits 422 validation errors via the event handler and then throws', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            json: async () => ({
                message: 'Validation failed',
                errors: { email: ['The email field is required.'] },
            }),
        })

        const driver = makeDriver()
        const errorPayloads: unknown[] = []
        await expect(
            driver.mutate('users', {}, (event, data) => {
                if (event === 'error') errorPayloads.push(data)
            }),
        ).rejects.toThrow('Validation failed')

        // The typed 'error' event carries the full validation detail, emitted once.
        expect(errorPayloads).toEqual([
            {
                message: 'Validation failed',
                errors: { email: ['The email field is required.'] },
            },
        ])
    })
})

describe('LomkitDriver error contract', () => {
    it('get throws on a non-OK HTTP response instead of returning an empty list', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

        const driver = makeDriver()
        const events: string[] = []
        await expect(
            driver.get('users', {}, event => events.push(event)),
        ).rejects.toThrow('HTTP 500')

        // 'error' is emitted exactly once (not duplicated by the catch block).
        expect(events.filter(e => e === 'error')).toHaveLength(1)
    })

    it('delete throws on a non-OK HTTP response instead of returning success:false', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })

        const driver = makeDriver()
        await expect(driver.delete('users', { resources: [1] })).rejects.toThrow('HTTP 404')
    })

    it('get rethrows a network error and emits a single error event', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'))

        const driver = makeDriver()
        const events: string[] = []
        await expect(
            driver.get('users', {}, event => events.push(event)),
        ).rejects.toThrow('network down')

        expect(events.filter(e => e === 'error')).toHaveLength(1)
    })
})
