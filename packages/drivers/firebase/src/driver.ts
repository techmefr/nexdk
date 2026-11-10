import { defineDriver } from 'nexdk'
import { createRequest, encodeId, encodeResource, resolveHeaders, splitId, toQuery, withCallOptions } from '@nexdk/http'
import type { HttpRequest } from '@nexdk/http'
import type { FirebaseConfig, FirebaseIdPayload, FirebaseResourceApi } from './types.ts'
import { decodeDocument, deleteField, encodeFields } from './values.ts'
import type { DecodeOptions, FirestoreDocument } from './values.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        firebase: FirebaseResourceApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        firebase: FirebaseResourceApi<T, true>
    }
}

interface FirebaseState {
    documentsUrl: string
    buildHeaders: () => Promise<Record<string, string>>
    request: HttpRequest
}

interface FirestoreList {
    documents?: FirestoreDocument[]
    nextPageToken?: string
}

type Ctx = FirebaseState & { resourceName: string }

const DEFAULT_BASE_URL = 'https://firestore.googleapis.com'

const collectionUrl = (ctx: Ctx): string => `${ctx.documentsUrl}/${encodeResource(ctx.resourceName)}`

const WRITTEN: DecodeOptions = { unsafeIntegers: 'bigint' }

const SIMPLE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/

const fieldPath = (key: string): string => (SIMPLE_FIELD.test(key) ? key : `\`${key.replace(/[\\`]/g, '\\$&')}\``)

const updateMask = (keys: string[]): string =>
    keys.map(key => `updateMask.fieldPaths=${encodeURIComponent(fieldPath(key))}`).join('&')

export const firebaseDriver = defineDriver<FirebaseConfig, FirebaseState, {
    get: (ctx: Ctx, payload: unknown, options: unknown) => Promise<unknown>
    find: (ctx: Ctx, payload: unknown, options: unknown) => Promise<unknown>
    create: (ctx: Ctx, payload: unknown, options: unknown) => Promise<unknown>
    update: (ctx: Ctx, payload: unknown, options: unknown) => Promise<unknown>
    remove: (ctx: Ctx, payload: unknown, options: unknown) => Promise<{ success: boolean }>
}>({
    name: 'firebase',
    setup: config => {
        const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
        const databaseId = encodeURIComponent(config.databaseId ?? '(default)')
        return {
            documentsUrl: `${baseUrl}/v1/projects/${encodeURIComponent(config.projectId)}/databases/${databaseId}/documents`,
            request: createRequest(config.fetch, { timeout: config.timeout, signal: config.signal, onResponse: config.onResponse }),
            buildHeaders: async () => ({
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(await resolveHeaders(config.headers)),
            }),
        }
    },
    methods: {
        get: async (ctx, payload, options) => {
            const query = (payload ?? {}) as Record<string, unknown>
            const headers = await ctx.buildHeaders()
            const fetchPage = (extra: Record<string, unknown>): Promise<FirestoreList> =>
                withCallOptions(ctx.request, options)<FirestoreList>(`${collectionUrl(ctx)}${toQuery({ ...query, ...extra })}`, {
                    method: 'GET',
                    headers,
                })

            if (query.pageToken !== undefined || query.pageSize !== undefined) {
                const page = await fetchPage({})
                const rows = (page.documents ?? []).map(document => decodeDocument(document))
                return Object.defineProperty(rows, 'nextPageToken', { value: page.nextPageToken || undefined, enumerable: false })
            }

            const documents: FirestoreDocument[] = []
            let pageToken: string | undefined
            do {
                const list = await fetchPage(pageToken === undefined ? {} : { pageToken })
                documents.push(...(list.documents ?? []))
                pageToken = list.nextPageToken || undefined
            } while (pageToken !== undefined)
            return documents.map(document => decodeDocument(document))
        },
        find: async (ctx, payload, options) => {
            const { id } = payload as FirebaseIdPayload
            const document = await withCallOptions(ctx.request, options)<FirestoreDocument>(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return decodeDocument(document)
        },
        create: async (ctx, payload, options) => {
            const { id, ...fields } = (payload ?? {}) as { id?: string } & Record<string, unknown>
            const query = id === undefined ? '' : `?documentId=${encodeId(id)}`
            const document = await withCallOptions(ctx.request, options)<FirestoreDocument>(`${collectionUrl(ctx)}${query}`, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: { fields: encodeFields(fields) },
            })
            return decodeDocument(document, WRITTEN)
        },
        update: async (ctx, payload, options) => {
            const { id, body } = splitId(payload)
            const fields = encodeFields(body)
            const removed = Object.keys(body).filter(key => body[key] === deleteField)
            const keys = [...Object.keys(fields), ...removed]
            if (keys.length === 0) throw new Error('update requires at least one field')
            const document = await withCallOptions(ctx.request, options)<FirestoreDocument>(
                `${collectionUrl(ctx)}/${encodeId(id)}?${updateMask(keys)}&currentDocument.exists=true`,
                {
                    method: 'PATCH',
                    headers: await ctx.buildHeaders(),
                    body: { fields },
                },
            )
            return decodeDocument(document, WRITTEN)
        },
        remove: async (ctx, payload, options) => {
            const { id } = payload as FirebaseIdPayload
            await withCallOptions(ctx.request, options)(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'DELETE',
                headers: await ctx.buildHeaders(),
            })
            return { success: true }
        },
    },
})

export function createFirebaseDriver(config: FirebaseConfig): ReturnType<typeof firebaseDriver> & { __apiUri: 'firebase' } {
    return firebaseDriver(config) as ReturnType<typeof firebaseDriver> & { __apiUri: 'firebase' }
}
