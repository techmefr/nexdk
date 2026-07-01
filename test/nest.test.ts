import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createNestDriver } from '../src/driver.ts'

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
    const driver = createNestDriver({ baseUrl: 'http://localhost:3000/api' })
    driver.bindResource('users', userResource)
    return driver as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
}

function okJson(value: unknown) {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => value })
}

describe('NestDriver verbs', () => {
    it('get → GET /{resource} with query params', async () => {
        okJson([{ id: 1, name: 'Alice', email: 'a@test.com' }])
        const driver = makeDriver()
        const result = await driver.get('users', { active: true })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/users?active=true',
            expect.objectContaining({ method: 'GET' }),
        )
        expect(result).toEqual([{ id: 1, name: 'Alice', email: 'a@test.com' }])
    })

    it('find → GET /{resource}/{id}', async () => {
        okJson({ id: 7, name: 'Bob', email: 'b@test.com' })
        const driver = makeDriver()
        await driver.find('users', { id: 7 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/users/7',
            expect.objectContaining({ method: 'GET' }),
        )
    })

    it('create → POST /{resource} with the body', async () => {
        okJson({ id: 1, name: 'Alice', email: 'a@test.com' })
        const driver = makeDriver()
        await driver.create('users', { name: 'Alice', email: 'a@test.com' })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/users',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'Alice', email: 'a@test.com' }),
            }),
        )
    })

    it('update → PATCH /{resource}/{id} with the id stripped from the body', async () => {
        okJson({ id: 1, name: 'Renamed', email: 'a@test.com' })
        const driver = makeDriver()
        await driver.update('users', { id: 1, name: 'Renamed' })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/users/1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ name: 'Renamed' }),
            }),
        )
    })

    it('remove → DELETE /{resource}/{id}', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        const driver = makeDriver()
        const result = await driver.remove('users', { id: 3 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/users/3',
            expect.objectContaining({ method: 'DELETE' }),
        )
        expect(result).toEqual({ success: true })
    })
})

describe('NestDriver headers', () => {
    it('applies a resolved headers config to the request', async () => {
        okJson([])
        const driver = createNestDriver({
            baseUrl: 'http://localhost:3000/api',
            headers: async () => ({ Authorization: 'Bearer refreshed' }),
        }) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
        await driver.get('users', {})

        const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer refreshed')
        expect(headers['Content-Type']).toBe('application/json')
    })
})

describe('NestDriver error contract', () => {
    it('emits error then throws on a non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        const driver = makeDriver()
        const events: string[] = []

        await expect(
            driver.get('users', {}, (event: string) => events.push(event)),
        ).rejects.toThrow('HTTP 500')

        expect(events).toContain('request')
        expect(events.filter(e => e === 'error')).toHaveLength(1)
        expect(events).not.toContain('success')
    })
})
