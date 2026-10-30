import { defineDriver } from 'nexdk'
import { encodeId, request, resolveHeaders, splitId } from '@nexdk/http'
import { toStrapiQuery } from './query.ts'
import type { StrapiConfig, StrapiIdPayload, StrapiResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        strapi: StrapiResourceApi<T>
    }
}

interface StrapiState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
}

interface StrapiEnvelope {
    data: unknown
}

type Ctx = StrapiState & { resourceName: string }

const collectionUrl = (ctx: Ctx): string => `${ctx.baseUrl}/api/${encodeURIComponent(ctx.resourceName)}`

export const strapiDriver = defineDriver<StrapiConfig, StrapiState, {
    get: (ctx: Ctx, payload: unknown) => Promise<unknown>
    find: (ctx: Ctx, payload: unknown) => Promise<unknown>
    create: (ctx: Ctx, payload: unknown) => Promise<unknown>
    update: (ctx: Ctx, payload: unknown) => Promise<unknown>
    remove: (ctx: Ctx, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'strapi',
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
            const envelope = await request<StrapiEnvelope>(`${collectionUrl(ctx)}${toStrapiQuery(payload)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return envelope.data
        },
        find: async (ctx, payload) => {
            const { id } = payload as StrapiIdPayload
            const envelope = await request<StrapiEnvelope>(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
            return envelope.data
        },
        create: async (ctx, payload) => {
            const envelope = await request<StrapiEnvelope>(collectionUrl(ctx), {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: { data: payload ?? {} },
            })
            return envelope.data
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const envelope = await request<StrapiEnvelope>(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'PUT',
                headers: await ctx.buildHeaders(),
                body: { data: body },
            })
            return envelope.data
        },
        remove: async (ctx, payload) => {
            const { id } = payload as StrapiIdPayload
            await request(`${collectionUrl(ctx)}/${encodeId(id)}`, {
                method: 'DELETE',
                headers: await ctx.buildHeaders(),
            })
            return { success: true }
        },
    },
})

export function createStrapiDriver(config: StrapiConfig): ReturnType<typeof strapiDriver> & { __apiUri: 'strapi' } {
    return strapiDriver(config) as ReturnType<typeof strapiDriver> & { __apiUri: 'strapi' }
}
