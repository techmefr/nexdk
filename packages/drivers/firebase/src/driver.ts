import { defineDriver } from 'nexdk'
import { encodeId, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { FirebaseConfig, FirebaseIdPayload, FirebaseResourceApi } from './types.ts'
import { decodeDocument, encodeFields } from './values.ts'
import type { FirestoreDocument } from './values.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        firebase: FirebaseResourceApi<T>
    }
}

interface FirebaseState {
    documentsUrl: string
    buildHeaders: () => Promise<Record<string, string>>
}

interface FirestoreList {
    documents?: FirestoreDocument[]
    nextPageToken?: string
}

type Ctx = FirebaseState & { resourceName: string }

const DEFAULT_BASE_URL = 'https://firestore.googleapis.com'

const collectionUrl = (ctx: Ctx): string => `${ctx.documentsUrl}/${encodeURIComponent(ctx.resourceName)}`

const SIMPLE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/

const fieldPath = (key: string): string => (SIMPLE_FIELD.test(key) ? key : `\`${key.replace(/[\\`]/g, '\\$&')}\``)

const updateMask = (keys: string[]): string =>
    keys.map(key => `updateMask.fieldPaths=${encodeURIComponent(fieldPath(key))}`).join('&')

export const firebaseDriver = defineDriver<FirebaseConfig, FirebaseState, {
    get: (ctx: Ctx, payload: unknown) => Promise<unknown>
    find: (ctx: Ctx, payload: unknown) => Promise<unknown>
    create: (ctx: Ctx, payload: unknown) => Promise<unknown>
    update: (ctx: Ctx, payload: unknown) => Promise<unknown>
    remove: (ctx: Ctx, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'firebase',
    setup: config => {
        const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
        const databaseId = encodeURIComponent(config.databaseId ?? '(default)')
        return {
            documentsUrl: `${baseUrl}/v1/projects/${encodeURIComponent(config.projectId)}/databases/${databaseId}/documents`,
            buildHeaders: async () => ({
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(await resolveHeaders(config.headers)),
            }),
        }
    },
    methods: {
        get: async (ctx, payload) => {
            const query = (payload ?? {}) as Record<string, unknown>
            const headers = await ctx.buildHeaders()
            const fetchPage = (extra: Record<string, unknown>): Promise<FirestoreList> =>
                request<FirestoreList>(`${collectionUrl(ctx)}${toQuery({ ...query, ...extra })}`, {
                    method: 'GET',
                    headers,
                })

            if (query.pageToken !== undefined || query.pageSize !== undefined) {
                return ((await fetchPage({})).documents ?? []).map(decodeDocument)
            }

            const documents: FirestoreDocument[] = []
            let pageToken: string | undefined
            do {
                const list = await fetchPage(pageToken === undefined ? {} : { pageToken })
                documents.push(...(list.documents ?? []))
                pageToken = list.nextPageToken || undefined
            } while (pageToken !== undefined)
            return documents.map(decodeDocument)
        },
        find: async (ctx, payload) => {
            const { id } = payload as FirebaseIdPayload
            const document = await request<FirestoreDocument>(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return decodeDocument(document)
        },
        create: async (ctx, payload) => {
            const { id, ...fields } = (payload ?? {}) as { id?: string } & Record<string, unknown>
            const query = id === undefined ? '' : `?documentId=${encodeId(id)}`
            const document = await request<FirestoreDocument>(`${collectionUrl(ctx)}${query}`, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: { fields: encodeFields(fields) },
            })
            return decodeDocument(document)
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const fields = encodeFields(body)
            const keys = Object.keys(fields)
            if (keys.length === 0) throw new Error('update requires at least one field')
            const document = await request<FirestoreDocument>(
                `${collectionUrl(ctx)}/${encodeId(id)}?${updateMask(keys)}&currentDocument.exists=true`,
                {
                    method: 'PATCH',
                    headers: await ctx.buildHeaders(),
                    body: { fields },
                },
            )
            return decodeDocument(document)
        },
        remove: async (ctx, payload) => {
            const { id } = payload as FirebaseIdPayload
            await request(`${collectionUrl(ctx)}/${encodeId(id)}`, {
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
