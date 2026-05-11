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

    it('exposes 422 validation errors via event handler', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            json: async () => ({
                message: 'Validation failed',
                errors: { email: ['The email field is required.'] },
            }),
        })

        const driver = makeDriver()
        let errorPayload: unknown = null
        await driver.mutate('users', {}, (event, data) => {
            if (event === 'error') errorPayload = data
        })

        expect(errorPayload).toEqual({
            message: 'Validation failed',
            errors: { email: ['The email field is required.'] },
        })
    })
})
