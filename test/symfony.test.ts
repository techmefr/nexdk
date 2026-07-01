import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createSymfonyDriver } from '../src/driver.ts'

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
    const driver = createSymfonyDriver({ baseUrl: 'http://localhost:8000/api' })
    driver.bindResource('users', userResource)
    return driver as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
}

function okJson(value: unknown) {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => value })
}

describe('SymfonyDriver verbs', () => {
    it('get → GET /{resource} and unwraps hydra:member', async () => {
        okJson({
            '@context': '/contexts/User',
            'hydra:member': [{ id: 1, name: 'Alice', email: 'a@test.com' }],
            'hydra:totalItems': 1,
        })
        const driver = makeDriver()
        const result = await driver.get('users', { active: true })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users?active=true',
            expect.objectContaining({ method: 'GET' }),
        )
        expect(result).toEqual([{ id: 1, name: 'Alice', email: 'a@test.com' }])
    })

    it('get → unwraps the newer "member" key', async () => {
        okJson({ member: [{ id: 2, name: 'Bob', email: 'b@test.com' }] })
        const driver = makeDriver()
        const result = await driver.get('users')

        expect(result).toEqual([{ id: 2, name: 'Bob', email: 'b@test.com' }])
    })

    it('get → returns a plain-array (non-Hydra) response as-is', async () => {
        okJson([{ id: 3, name: 'Carol', email: 'c@test.com' }])
        const driver = makeDriver()
        const result = await driver.get('users')

        expect(result).toEqual([{ id: 3, name: 'Carol', email: 'c@test.com' }])
    })

    it('find → GET /{resource}/{id}', async () => {
        okJson({ id: 7, name: 'Bob', email: 'b@test.com' })
        const driver = makeDriver()
        await driver.find('users', { id: 7 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/7',
            expect.objectContaining({ method: 'GET' }),
        )
    })

    it('create → POST /{resource} with application/ld+json', async () => {
        okJson({ id: 1, name: 'Alice', email: 'a@test.com' })
        const driver = makeDriver()
        await driver.create('users', { name: 'Alice', email: 'a@test.com' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:8000/api/users')
        expect(init.method).toBe('POST')
        expect(init.body).toBe(JSON.stringify({ name: 'Alice', email: 'a@test.com' }))
        expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/ld+json')
    })

    it('update → PATCH /{resource}/{id} with application/merge-patch+json', async () => {
        okJson({ id: 1, name: 'Renamed', email: 'a@test.com' })
        const driver = makeDriver()
        await driver.update('users', { id: 1, name: 'Renamed' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:8000/api/users/1')
        expect(init.method).toBe('PATCH')
        expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }))
        expect((init.headers as Record<string, string>)['Content-Type']).toBe(
            'application/merge-patch+json',
        )
    })

    it('remove → DELETE /{resource}/{id}', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        const driver = makeDriver()
        const result = await driver.remove('users', { id: 3 })

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/users/3',
            expect.objectContaining({ method: 'DELETE' }),
        )
        expect(result).toEqual({ success: true })
    })
})

describe('SymfonyDriver headers', () => {
    it('applies a resolved headers config to the request', async () => {
        okJson({ 'hydra:member': [] })
        const driver = createSymfonyDriver({
            baseUrl: 'http://localhost:8000/api',
            headers: async () => ({ Authorization: 'Bearer refreshed' }),
        }) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
        await driver.get('users', {})

        const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer refreshed')
        expect(headers.Accept).toBe('application/ld+json')
    })
})

describe('SymfonyDriver error contract', () => {
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
