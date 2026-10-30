import { defineDriver } from 'nexdk'
import { encodeId, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { NestConfig, NestIdPayload, NestResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nest: NestResourceApi<T>
    }
}

interface NestState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
}

export const nestDriver = defineDriver<NestConfig, NestState, {
    get: (ctx: NestState & { resourceName: string }, payload: unknown) => Promise<unknown>
    find: (ctx: NestState & { resourceName: string }, payload: unknown) => Promise<unknown>
    create: (ctx: NestState & { resourceName: string }, payload: unknown) => Promise<unknown>
    update: (ctx: NestState & { resourceName: string }, payload: unknown) => Promise<unknown>
    remove: (ctx: NestState & { resourceName: string }, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'nest',
    setup: config => {
        const baseUrl = config.baseUrl.replace(/\/$/, '')
        return {
            baseUrl,
            buildHeaders: async () => ({
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(await resolveHeaders(config.headers)),
            }),
        }
    },
    methods: {
        get: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}${toQuery(payload)}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        find: async (ctx, payload) => {
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        create: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}`
            return request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: payload ?? {},
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            await request(url, { method: 'DELETE', headers: await ctx.buildHeaders() })
            return { success: true }
        },
    },
})

export function createNestDriver(config: NestConfig): ReturnType<typeof nestDriver> & { __apiUri: 'nest' } {
    return nestDriver(config) as ReturnType<typeof nestDriver> & { __apiUri: 'nest' }
}
