import { defineDriver } from 'nexdk'
import type { SdkCallOptions } from 'nexdk'
import { createRequest, encodeId, encodeResource, resolveHeaders, splitId, toQuery, withCallOptions } from '@nexdk/http'
import type { HttpRequest } from '@nexdk/http'
import type { NestConfig, NestIdPayload, NestResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nest: NestResourceApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        nest: NestResourceApi<T, true>
    }
}

interface NestState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
    request: HttpRequest
}

export const nestDriver = defineDriver<NestConfig, NestState, {
    get: (ctx: NestState & { resourceName: string }, payload: unknown, options: SdkCallOptions | undefined) => Promise<unknown>
    find: (ctx: NestState & { resourceName: string }, payload: unknown, options: SdkCallOptions | undefined) => Promise<unknown>
    create: (ctx: NestState & { resourceName: string }, payload: unknown, options: SdkCallOptions | undefined) => Promise<unknown>
    update: (ctx: NestState & { resourceName: string }, payload: unknown, options: SdkCallOptions | undefined) => Promise<unknown>
    remove: (ctx: NestState & { resourceName: string }, payload: unknown, options: SdkCallOptions | undefined) => Promise<{ success: boolean }>
}>({
    name: 'nest',
    setup: config => {
        const baseUrl = config.baseUrl.replace(/\/$/, '')
        return {
            baseUrl,
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
            const request = withCallOptions(ctx.request, options)
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}${toQuery(payload)}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        find: async (ctx, payload, options) => {
            const request = withCallOptions(ctx.request, options)
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        create: async (ctx, payload, options) => {
            const request = withCallOptions(ctx.request, options)
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}`
            return request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: payload ?? {},
            })
        },
        update: async (ctx, payload, options) => {
            const request = withCallOptions(ctx.request, options)
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body,
            })
        },
        remove: async (ctx, payload, options) => {
            const request = withCallOptions(ctx.request, options)
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            await request(url, { method: 'DELETE', headers: await ctx.buildHeaders() })
            return { success: true }
        },
    },
})

export function createNestDriver(config: NestConfig): ReturnType<typeof nestDriver> & { __apiUri: 'nest' } {
    return nestDriver(config) as ReturnType<typeof nestDriver> & { __apiUri: 'nest' }
}
