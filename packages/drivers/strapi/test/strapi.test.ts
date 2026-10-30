import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createStrapiDriver } from '../src/driver.ts'
import { toStrapiQuery } from '../src/query.ts'

const articleResource = defineResource({
    name: 'articles',
    schema: z.object({ id: z.number(), documentId: z.string(), title: z.string() }),
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
    const driver = createStrapiDriver({ baseUrl: 'http://localhost:1337' })
    driver.bindResource('articles', articleResource)
    return driver as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
}

function okJson(value: unknown) {
    mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(value), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
}

describe('toStrapiQuery', () => {
    it('builds bracket notation for nested filters and arrays', () => {
        const query = toStrapiQuery({
            filters: { title: { $eq: 'Hi' } },
            sort: ['title:asc'],
            pagination: { page: 2 },
        })
        expect(decodeURIComponent(query)).toBe(
            '?filters[title][$eq]=Hi&sort[0]=title:asc&pagination[page]=2',
        )
    })

    it('returns an empty string without parameters', () => {
        expect(toStrapiQuery(undefined)).toBe('')
        expect(toStrapiQuery({})).toBe('')
    })
})

describe('StrapiDriver', () => {
    it('get → GET /api/{resource} and unwraps data', async () => {
        okJson({ data: [{ id: 1, documentId: 'd1', title: 'A' }], meta: {} })
        const result = await makeDriver().get('articles', { pagination: { pageSize: 5 } })

        expect(decodeURIComponent(mockFetch.mock.calls[0][0])).toBe(
            'http://localhost:1337/api/articles?pagination[pageSize]=5',
        )
        expect(result).toEqual([{ id: 1, documentId: 'd1', title: 'A' }])
    })

    it('find → GET /api/{resource}/{id} with the encoded id', async () => {
        okJson({ data: { id: 1, documentId: 'd/1', title: 'A' } })
        await makeDriver().find('articles', { id: 'd/1' })

        expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:1337/api/articles/d%2F1')
    })

    it('create → POST wraps the body in data', async () => {
        okJson({ data: { id: 2, documentId: 'd2', title: 'New' } })
        await makeDriver().create('articles', { title: 'New' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:1337/api/articles')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ data: { title: 'New' } })
    })

    it('update → PUT /api/{resource}/{id} wraps the fields in data', async () => {
        okJson({ data: { id: 1, documentId: 'd1', title: 'Edited' } })
        await makeDriver().update('articles', { id: 'd1', title: 'Edited' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('http://localhost:1337/api/articles/d1')
        expect(init.method).toBe('PUT')
        expect(JSON.parse(init.body)).toEqual({ data: { title: 'Edited' } })
    })

    it('remove → DELETE /api/{resource}/{id}', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
        const result = await makeDriver().remove('articles', { id: 'd1' })

        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
        expect(result).toEqual({ success: true })
    })
})
