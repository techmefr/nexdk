import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createPocketbaseDriver } from '../src/driver.ts'

const postResource = defineResource({
    name: 'posts',
    schema: z.object({ id: z.string(), title: z.string() }),
})

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function makeDriver() {
    const driver = createPocketbaseDriver({
        baseUrl: 'http://localhost:8090/',
        headers: { Authorization: 'token' },
    })
    driver.bindResource('posts', postResource)
    return driver as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
}

function okJson(value: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(value), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
}

describe('PocketbaseDriver', () => {
    it('get → GET records with query and unwraps items', async () => {
        okJson({ page: 1, perPage: 30, totalItems: 1, items: [{ id: 'a1', title: 'Hello' }] })
        const result = await makeDriver().get('posts', { filter: 'title="Hello"', perPage: 5 })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe(
            'http://localhost:8090/api/collections/posts/records?filter=title%3D%22Hello%22&perPage=5',
        )
        expect(init).toEqual(expect.objectContaining({ method: 'GET' }))
        expect(result).toEqual([{ id: 'a1', title: 'Hello' }])
    })

    it('find → GET records/{id} with the encoded id', async () => {
        okJson({ id: 'a/1', title: 'Hello' })
        await makeDriver().find('posts', { id: 'a/1' })

        expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8090/api/collections/posts/records/a%2F1')
    })

    it('create → POST records', async () => {
        okJson({ id: 'a1', title: 'New' })
        await makeDriver().create('posts', { title: 'New' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:8090/api/collections/posts/records')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ title: 'New' })
    })

    it('update → PATCH records/{id} without the id in the body', async () => {
        okJson({ id: 'a1', title: 'Edited' })
        await makeDriver().update('posts', { id: 'a1', title: 'Edited' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:8090/api/collections/posts/records/a1')
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ title: 'Edited' })
    })

    it('remove → DELETE records/{id}', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
        const result = await makeDriver().remove('posts', { id: 'a1' })

        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
        expect(result).toEqual({ success: true })
    })

    it('sends the resolved headers', async () => {
        okJson({ items: [] })
        await makeDriver().get('posts', {})

        const headers = new Headers(mockFetch.mock.calls[0][1].headers as HeadersInit)
        expect(headers.get('Authorization')).toBe('token')
    })
})
