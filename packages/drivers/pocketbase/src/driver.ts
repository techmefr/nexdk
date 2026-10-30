import { defineDriver } from 'nexdk'
import { encodeId, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { PocketbaseConfig, PocketbaseIdPayload, PocketbaseResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        pocketbase: PocketbaseResourceApi<T>
    }
}

interface PocketbaseState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
}

interface PocketbaseList {
    items: unknown[]
}

type Ctx = PocketbaseState & { resourceName: string }

const recordsUrl = (ctx: Ctx): string =>
    `${ctx.baseUrl}/api/collections/${encodeURIComponent(ctx.resourceName)}/records`

export const pocketbaseDriver = defineDriver<PocketbaseConfig, PocketbaseState, {
    get: (ctx: Ctx, payload: unknown) => Promise<unknown>
    find: (ctx: Ctx, payload: unknown) => Promise<unknown>
    create: (ctx: Ctx, payload: unknown) => Promise<unknown>
    update: (ctx: Ctx, payload: unknown) => Promise<unknown>
    remove: (ctx: Ctx, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'pocketbase',
    setup: config => ({
        baseUrl: config.baseUrl.replace(/\/$/, ''),
        buildHeaders: async () => ({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(await resolveHeaders(config.headers)),
        }),
    }),
    methods: {
        get: async (ctx, payload) => {
            const list = await request<PocketbaseList>(`${recordsUrl(ctx)}${toQuery(payload)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return list.items
        },
        find: async (ctx, payload) => {
            const { id } = payload as PocketbaseIdPayload
            return request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
        },
        create: async (ctx, payload) =>
            request(recordsUrl(ctx), {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: payload ?? {},
            }),
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            return request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as PocketbaseIdPayload
            await request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'DELETE',
                headers: await ctx.buildHeaders(),
            })
            return { success: true }
        },
    },
})

export function createPocketbaseDriver(
    config: PocketbaseConfig,
): ReturnType<typeof pocketbaseDriver> & { __apiUri: 'pocketbase' } {
    return pocketbaseDriver(config) as ReturnType<typeof pocketbaseDriver> & { __apiUri: 'pocketbase' }
}
