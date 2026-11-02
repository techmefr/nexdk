import { describe, expect, it, vi } from 'vitest'
import { createPocketbaseDriver } from '../src/driver.ts'
import type { PocketbaseCollection } from '../src/types.ts'

function jsonResponse(value: unknown) {
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function makeDriver(injected: ReturnType<typeof vi.fn>) {
    return createPocketbaseDriver({ baseUrl: 'http://localhost:8090', fetch: injected }) as unknown as {
        get: (resource: string, payload?: unknown) => Promise<PocketbaseCollection<{ id: string }>>
    }
}

describe('pocketbase pagination', () => {
    it('exposes the server totals of an explicit page as a non enumerable property', async () => {
        const injected = vi
            .fn()
            .mockResolvedValue(jsonResponse({ page: 2, perPage: 2, totalItems: 5, totalPages: 3, items: [{ id: 'c' }, { id: 'd' }] }))

        const rows = await makeDriver(injected).get('posts', { page: 2, perPage: 2 })

        expect(rows).toEqual([{ id: 'c' }, { id: 'd' }])
        expect(rows.pagination).toEqual({ page: 2, perPage: 2, totalItems: 5, totalPages: 3 })
        expect(Object.keys(rows)).toEqual(['0', '1'])
        expect(injected).toHaveBeenCalledTimes(1)
    })

    it('exposes the totals of the first page when every page is collected', async () => {
        const injected = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ page: 1, perPage: 1, totalItems: 2, totalPages: 2, items: [{ id: 'a' }] }))
            .mockResolvedValueOnce(jsonResponse({ page: 2, perPage: 1, totalItems: 2, totalPages: 2, items: [{ id: 'b' }] }))

        const rows = await makeDriver(injected).get('posts')

        expect(rows).toEqual([{ id: 'a' }, { id: 'b' }])
        expect(rows.pagination?.totalItems).toBe(2)
    })

    it('leaves the total undefined when the server skips it', async () => {
        const injected = vi
            .fn()
            .mockResolvedValue(jsonResponse({ page: 1, perPage: 2, totalItems: -1, totalPages: -1, items: [{ id: 'a' }] }))

        const rows = await makeDriver(injected).get('posts', { page: 1, perPage: 2, skipTotal: 1 })

        expect(rows.pagination?.totalItems).toBeUndefined()
        expect(rows.pagination?.totalPages).toBeUndefined()
    })
})
