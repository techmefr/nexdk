import { describe, expect, it, vi } from 'vitest'
import { createStrapiDriver } from '../src/driver.ts'
import type { StrapiCollection } from '../src/types.ts'

function jsonResponse(value: unknown) {
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function makeDriver(injected: ReturnType<typeof vi.fn>) {
    return createStrapiDriver({ baseUrl: 'http://localhost:1337', fetch: injected }) as unknown as {
        get: (resource: string, payload?: unknown) => Promise<StrapiCollection<{ id: number }>>
    }
}

describe('strapi pagination', () => {
    it('exposes meta.pagination of an explicit page as a non enumerable property', async () => {
        const meta = { pagination: { page: 2, pageSize: 2, pageCount: 3, total: 5 } }
        const injected = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 3 }, { id: 4 }], meta }))

        const rows = await makeDriver(injected).get('articles', { pagination: { page: 2, pageSize: 2 } })

        expect(rows).toEqual([{ id: 3 }, { id: 4 }])
        expect(rows.pagination).toEqual(meta.pagination)
        expect(Object.keys(rows)).toEqual(['0', '1'])
        expect(injected).toHaveBeenCalledTimes(1)
    })

    it('exposes the total when every page is collected', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }], meta: { pagination: { page: 1, pageSize: 1, pageCount: 2, total: 2 } } }))
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: 2 }], meta: { pagination: { page: 2, pageSize: 1, pageCount: 2, total: 2 } } }))

        const rows = await makeDriver(injected).get('articles')

        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
        expect(rows.pagination?.total).toBe(2)
    })

    it('has no pagination property when the server sends no meta', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 1 }] }))

        const rows = await makeDriver(injected).get('articles', { pagination: { page: 1, pageSize: 5 } })

        expect(rows.pagination).toBeUndefined()
    })
})
