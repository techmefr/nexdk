import { defineDriver, resolveHeaders } from 'nexdk'
import type { NestConfig, NestIdPayload, NestResourceApi, NestUpdatePayload } from './types.ts'

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

// Serialize a query object into a URL search string ("" when empty).
function toQuery(payload: unknown): string {
    if (payload === undefined || payload === null) return ''
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (value !== undefined && value !== null) params.set(key, String(value))
    }
    const query = params.toString()
    return query ? `?${query}` : ''
}

// Split an id payload into the id (for the URL) and the remaining body fields.
function splitId(payload: unknown): { id: number | string; body: Record<string, unknown> } {
    const { id, ...body } = (payload ?? {}) as NestUpdatePayload
    return { id, body }
}

// Perform the fetch and throw on a non-OK response. defineDriver's wrapper turns
// the throw into emit('error') + rethrow, so the contract is honored for free.
async function request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
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
                body: JSON.stringify(payload ?? {}),
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body: JSON.stringify(body),
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as NestIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            const response = await fetch(url, { method: 'DELETE', headers: await ctx.buildHeaders() })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return { success: true }
        },
    },
})

// Factory returning a nest driver carrying the `__apiUri` phantom marker, so the
// typed SDK resolves each resource to NestResourceApi<T>.
export function createNestDriver(config: NestConfig): ReturnType<typeof nestDriver> & { __apiUri: 'nest' } {
    return nestDriver(config) as ReturnType<typeof nestDriver> & { __apiUri: 'nest' }
}
