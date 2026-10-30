import { defineDriver } from 'nexdk'
import { request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
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
}

type Ctx = FirebaseState & { resourceName: string }

const DEFAULT_BASE_URL = 'https://firestore.googleapis.com'

const collectionUrl = (ctx: Ctx): string => `${ctx.documentsUrl}/${encodeURIComponent(ctx.resourceName)}`

const updateMask = (fields: Record<string, unknown>): string =>
    Object.keys(fields)
        .map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
        .join('&')

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
            const list = await request<FirestoreList>(`${collectionUrl(ctx)}${toQuery(payload)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return (list.documents ?? []).map(decodeDocument)
        },
        find: async (ctx, payload) => {
            const { id } = payload as FirebaseIdPayload
            const document = await request<FirestoreDocument>(`${collectionUrl(ctx)}/${encodeURIComponent(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return decodeDocument(document)
        },
        create: async (ctx, payload) => {
            const { id, ...fields } = (payload ?? {}) as { id?: string } & Record<string, unknown>
            const query = id === undefined ? '' : `?documentId=${encodeURIComponent(id)}`
            const document = await request<FirestoreDocument>(`${collectionUrl(ctx)}${query}`, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: { fields: encodeFields(fields) },
            })
            return decodeDocument(document)
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const document = await request<FirestoreDocument>(
                `${collectionUrl(ctx)}/${encodeURIComponent(id)}?${updateMask(body)}`,
                {
                    method: 'PATCH',
                    headers: await ctx.buildHeaders(),
                    body: { fields: encodeFields(body) },
                },
            )
            return decodeDocument(document)
        },
        remove: async (ctx, payload) => {
            const { id } = payload as FirebaseIdPayload
            await request(`${collectionUrl(ctx)}/${encodeURIComponent(id)}`, {
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
