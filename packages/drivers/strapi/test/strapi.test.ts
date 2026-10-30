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

describe('StrapiDriver pagination', () => {
    it('follows every page when the caller sets none', async () => {
        okJson({ data: [{ id: 1 }, { id: 2 }], meta: { pagination: { page: 1, pageSize: 2, pageCount: 2, total: 3 } } })
        okJson({ data: [{ id: 3 }], meta: { pagination: { page: 2, pageSize: 2, pageCount: 2, total: 3 } } })

        const result = await makeDriver().get('articles', { sort: ['title:asc'] })

        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
        expect(mockFetch).toHaveBeenCalledTimes(2)
        expect(decodeURIComponent(mockFetch.mock.calls[1][0] as string)).toContain('pagination[page]=2')
    })

    it('respects an explicit page', async () => {
        okJson({ data: [{ id: 3 }], meta: { pagination: { page: 2, pageSize: 2, pageCount: 5, total: 9 } } })
        const result = await makeDriver().get('articles', { pagination: { page: 2, pageSize: 2 } })
        expect(result).toEqual([{ id: 3 }])
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('respects an explicit pageSize', async () => {
        okJson({ data: [{ id: 1 }], meta: { pagination: { page: 1, pageSize: 1, pageCount: 4, total: 4 } } })
        const result = await makeDriver().get('articles', { pagination: { pageSize: 1 } })
        expect(result).toEqual([{ id: 1 }])
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })
})

describe('toStrapiQuery safety', () => {
    it('throws on a circular payload', () => {
        const filters: Record<string, unknown> = {}
        filters.self = filters
        expect(() => toStrapiQuery({ filters })).toThrow('circular')
    })

    it('throws beyond the maximum depth', () => {
        let nested: Record<string, unknown> = { leaf: 1 }
        for (let i = 0; i < 40; i++) nested = { next: nested }
        expect(() => toStrapiQuery({ filters: nested })).toThrow('maximum depth')
    })

    it('accepts a shared non-circular reference', () => {
        const shared = { $eq: 'a' }
        expect(decodeURIComponent(toStrapiQuery({ filters: { a: shared, b: shared } }))).toBe(
            '?filters[a][$eq]=a&filters[b][$eq]=a',
        )
    })
})
