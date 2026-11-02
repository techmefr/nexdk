import { describe, expect, it, vi } from 'vitest'
import { createFirebaseDriver } from '../src/driver.ts'
import { decodeDocument, deleteField, encodeFields } from '../src/values.ts'

type Call = (resource: string, payload?: unknown) => Promise<any>

function jsonResponse(value: unknown) {
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function makeDriver(injected: unknown) {
    return createFirebaseDriver({ projectId: 'demo', fetch: injected as typeof fetch }) as unknown as {
        get: Call
        create: Call
        update: Call
    }
}

const doc = (id: string, fields: Record<string, unknown> = {}) => ({
    name: `projects/demo/databases/(default)/documents/notes/${id}`,
    fields,
})

describe('firebase manual pagination', () => {
    it('exposes nextPageToken without making it enumerable', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse({ documents: [doc('a')], nextPageToken: 'tok' }))

        const rows = await makeDriver(injected).get('notes', { pageSize: 1 })

        expect(rows).toEqual([{ id: 'a' }])
        expect(rows.nextPageToken).toBe('tok')
        expect(Object.keys(rows)).toEqual(['0'])
    })

    it('leaves nextPageToken undefined on the last page', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse({ documents: [doc('a')] }))

        const rows = await makeDriver(injected).get('notes', { pageToken: 'tok' })

        expect(rows.nextPageToken).toBeUndefined()
    })
})

describe('firebase orderBy', () => {
    it('sends a space as %20', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse({ documents: [] }))

        await makeDriver(injected).get('notes', { orderBy: 'n desc', pageSize: 5 })

        expect(String(injected.mock.calls[0][0])).toContain('orderBy=n%20desc')
    })
})

describe('firebase number encoding', () => {
    it('keeps safe integers as integerValue', () => {
        expect(encodeFields({ a: 7, b: -3, c: Number.MAX_SAFE_INTEGER })).toEqual({
            a: { integerValue: '7' },
            b: { integerValue: '-3' },
            c: { integerValue: String(Number.MAX_SAFE_INTEGER) },
        })
    })

    it('encodes numbers beyond the safe range as doubleValue instead of invalid integer text', () => {
        expect(encodeFields({ big: 1e21, edge: 2 ** 53 })).toEqual({
            big: { doubleValue: 1e21 },
            edge: { doubleValue: 2 ** 53 },
        })
    })

    it('encodes NaN and the infinities as the strings Firestore accepts and decodes them back', () => {
        const fields = encodeFields({ n: Number.NaN, p: Number.POSITIVE_INFINITY, m: Number.NEGATIVE_INFINITY })

        expect(fields).toEqual({
            n: { doubleValue: 'NaN' },
            p: { doubleValue: 'Infinity' },
            m: { doubleValue: '-Infinity' },
        })
        expect(decodeDocument({ name: 'a/b/c', fields })).toEqual({
            n: Number.NaN,
            p: Number.POSITIVE_INFINITY,
            m: Number.NEGATIVE_INFINITY,
            id: 'c',
        })
    })
})

describe('firebase writes with unsafe integers', () => {
    it('returns a bigint from create instead of throwing after the write', async () => {
        const written = { b: { integerValue: String(2n ** 60n) } }
        const injected = vi.fn().mockResolvedValue(jsonResponse(doc('big', written)))

        const created = await makeDriver(injected).create('notes', { id: 'big', b: 2n ** 60n })

        expect(created).toEqual({ id: 'big', b: 2n ** 60n })
    })

    it('returns a bigint from update', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(doc('big', { b: { integerValue: String(2n ** 60n) } })))

        expect(await makeDriver(injected).update('notes', { id: 'big', b: 2n ** 60n })).toEqual({ id: 'big', b: 2n ** 60n })
    })

    it('still throws when decoding a stored unsafe integer on reads', () => {
        const unsafe = { name: 'a/b/c', fields: { b: { integerValue: '9007199254740993' } } }

        expect(() => decodeDocument(unsafe)).toThrow('safe integer')
        expect(decodeDocument(unsafe, { unsafeIntegers: 'bigint' })).toEqual({ b: 9007199254740993n, id: 'c' })
    })
})

describe('firebase deleteField', () => {
    it('masks the field without sending a value', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(doc('a', { keep: { integerValue: '1' } })))

        await makeDriver(injected).update('notes', { id: 'a', keep: 1, gone: deleteField })

        const [url, init] = injected.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('updateMask.fieldPaths=keep')
        expect(url).toContain('updateMask.fieldPaths=gone')
        expect(JSON.parse(String(init.body))).toEqual({ fields: { keep: { integerValue: '1' } } })
    })

    it('accepts an update made only of deleted fields', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(doc('a')))

        await makeDriver(injected).update('notes', { id: 'a', gone: deleteField })

        const [url, init] = injected.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('updateMask.fieldPaths=gone')
        expect(JSON.parse(String(init.body))).toEqual({ fields: {} })
    })

    it('is skipped by encodeFields', () => {
        expect(encodeFields({ a: deleteField })).toEqual({})
    })
})

describe('firebase resource name guard', () => {
    it.each(['', '.', '..'])('refuses the resource name "%s"', async name => {
        const injected = vi.fn()

        await expect(makeDriver(injected).get(name)).rejects.toThrow('Invalid resource name')
        expect(injected).not.toHaveBeenCalled()
    })
})
