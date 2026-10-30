import { defineResource } from 'nexdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createFirebaseDriver } from '../src/driver.ts'
import { decodeDocument, encodeFields } from '../src/values.ts'

const noteResource = defineResource({
    name: 'notes',
    schema: z.object({ id: z.string(), title: z.string(), stars: z.number() }),
})

const DOCS = 'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents'

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function makeDriver() {
    const driver = createFirebaseDriver({ projectId: 'demo', headers: { Authorization: 'Bearer t' } })
    driver.bindResource('notes', noteResource)
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

const firestoreNote = {
    name: 'projects/demo/databases/(default)/documents/notes/n1',
    fields: { title: { stringValue: 'Hi' }, stars: { integerValue: '3' } },
}

describe('Firestore value codec', () => {
    it('round-trips nested records', () => {
        const record = { a: 1, b: 1.5, c: 'x', d: true, e: null, f: [1, 'y'], g: { h: 2 } }
        const decoded = decodeDocument({ name: 'x/y/z', fields: encodeFields(record) })
        expect(decoded).toEqual({ id: 'z', ...record })
    })

    it('encodes integers as strings and dates as timestamps', () => {
        expect(encodeFields({ n: 7, when: new Date('2026-01-02T03:04:05.000Z') })).toEqual({
            n: { integerValue: '7' },
            when: { timestampValue: '2026-01-02T03:04:05.000Z' },
        })
    })
})

describe('FirebaseDriver', () => {
    it('get → GET collection and decodes documents', async () => {
        okJson({ documents: [firestoreNote] })
        const result = await makeDriver().get('notes', { pageSize: 10 })

        expect(mockFetch.mock.calls[0][0]).toBe(`${DOCS}/notes?pageSize=10`)
        expect(result).toEqual([{ id: 'n1', title: 'Hi', stars: 3 }])
    })

    it('get → empty list when Firestore returns no documents', async () => {
        okJson({})
        expect(await makeDriver().get('notes', {})).toEqual([])
    })

    it('find → GET document with the encoded id', async () => {
        okJson(firestoreNote)
        const result = await makeDriver().find('notes', { id: 'n/1' })

        expect(mockFetch.mock.calls[0][0]).toBe(`${DOCS}/notes/n%2F1`)
        expect(result).toEqual({ id: 'n1', title: 'Hi', stars: 3 })
    })

    it('create → POST with encoded fields and optional documentId', async () => {
        okJson(firestoreNote)
        await makeDriver().create('notes', { id: 'n1', title: 'Hi', stars: 3 })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe(`${DOCS}/notes?documentId=n1`)
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({
            fields: { title: { stringValue: 'Hi' }, stars: { integerValue: '3' } },
        })
    })

    it('update → PATCH with an updateMask for the changed fields only', async () => {
        okJson(firestoreNote)
        await makeDriver().update('notes', { id: 'n1', title: 'Edited' })

        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe(`${DOCS}/notes/n1?updateMask.fieldPaths=title&currentDocument.exists=true`)
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ fields: { title: { stringValue: 'Edited' } } })
    })

    it('update quotes field names that are not simple identifiers', async () => {
        okJson(firestoreNote)
        await makeDriver().update('notes', { id: 'n1', 'a.b': 1 })

        expect(decodeURIComponent(mockFetch.mock.calls[0][0])).toContain('updateMask.fieldPaths=`a.b`')
    })

    it('update rejects an empty body instead of replacing the document', async () => {
        await expect(makeDriver().update('notes', { id: 'n1' })).rejects.toThrow()
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects dot-segment ids', async () => {
        await expect(makeDriver().remove('notes', { id: '..' })).rejects.toThrow('Invalid id')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('decodes reference values without throwing and keeps the document id', async () => {
        okJson({
            documents: [
                {
                    name: 'projects/demo/databases/(default)/documents/notes/n9',
                    fields: { ref: { referenceValue: 'projects/demo/x' }, id: { stringValue: 'spoof' } },
                },
            ],
        })
        const [note] = (await makeDriver().get('notes', {})) as Array<Record<string, unknown>>

        expect(note).toEqual({ ref: 'projects/demo/x', id: 'n9' })
    })

    it('remove → DELETE document', async () => {
        okJson({})
        const result = await makeDriver().remove('notes', { id: 'n1' })

        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
        expect(result).toEqual({ success: true })
    })

    it('sends the resolved headers', async () => {
        okJson({})
        await makeDriver().get('notes', {})

        const headers = new Headers(mockFetch.mock.calls[0][1].headers as HeadersInit)
        expect(headers.get('Authorization')).toBe('Bearer t')
    })
})
