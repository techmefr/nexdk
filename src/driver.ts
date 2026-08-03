import { defineDriver } from 'nexdk'
import { request, resolveHeaders, splitId, toQuery } from '@pilota/http'
import type { NestConfig, NestIdPayload, NestResourceApi } from './types.ts'

// Register the nest per-resource API in core's registry so the typed SDK can
// resolve `sdk.nest.<resource>` to NestResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nest: NestResourceApi<T>
    }
}

// State built once from the config and spread into every method's ctx.
interface NestState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
}

// Conventional REST CRUD driver for the common NestJS controller shape. Built
// with defineDriver: the method bodies carry only the protocol translation; the
// request/success/error events are supplied by the helper.
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
            const url = `${ctx.baseUrl}/${ctx.resourceName}${toQuery(payload)}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        find: async (ctx, payload) => {
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, { method: 'GET', headers: await ctx.buildHeaders() })
        },
        create: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${ctx.resourceName}`
            return request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: payload ?? {},
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            await request(url, { method: 'DELETE', headers: await ctx.buildHeaders() })
            return { success: true }
        },
    },
})

// Factory returning a nest driver carrying the `__apiUri` phantom marker, so the
// typed SDK resolves each resource to NestResourceApi<T>.
export function createNestDriver(config: NestConfig): ReturnType<typeof nestDriver> & { __apiUri: 'nest' } {
    return nestDriver(config) as ReturnType<typeof nestDriver> & { __apiUri: 'nest' }
}
