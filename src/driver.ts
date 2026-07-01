import { defineDriver, resolveHeaders } from 'nexdk'
import type {
    SymfonyConfig,
    SymfonyIdPayload,
    SymfonyResourceApi,
    SymfonyUpdatePayload,
} from './types.ts'

// Register the symfony per-resource API in core's registry so the typed SDK can
// resolve `sdk.symfony.<resource>` to SymfonyResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        symfony: SymfonyResourceApi<T>
    }
}

// State built once from the config and spread into every method's ctx. Two
// header builders: JSON-LD for reads/create, merge-patch for update — the
// meaningful API Platform difference from a plain REST (nest) driver.
interface SymfonyState {
    baseUrl: string
    buildHeaders: (contentType: string) => Promise<Record<string, string>>
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
    const { id, ...body } = (payload ?? {}) as SymfonyUpdatePayload
    return { id, body }
}

// Unwrap an API Platform collection. Responses are Hydra by default
// (`hydra:member`); newer API Platform / JSON serializers may use `member`.
// A plain array (non-Hydra endpoint) is returned as-is.
function unwrapCollection(body: unknown): unknown {
    if (body && typeof body === 'object') {
        const hydra = body as Record<string, unknown>
        if ('hydra:member' in hydra) return hydra['hydra:member']
        if ('member' in hydra) return hydra.member
    }
    return body
}

// Perform the fetch and throw on a non-OK response. defineDriver's wrapper turns
// the throw into emit('error') + rethrow, so the contract is honored for free.
async function request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
}

// API Platform (Symfony) REST driver over the Hydra/JSON-LD conventions. Built
// with defineDriver: the method bodies carry only the protocol translation; the
// request/success/error events are supplied by the helper.
export const symfonyDriver = defineDriver<SymfonyConfig, SymfonyState, {
    get: (ctx: SymfonyState & { resourceName: string }, payload: unknown) => Promise<unknown>
    find: (ctx: SymfonyState & { resourceName: string }, payload: unknown) => Promise<unknown>
    create: (ctx: SymfonyState & { resourceName: string }, payload: unknown) => Promise<unknown>
    update: (ctx: SymfonyState & { resourceName: string }, payload: unknown) => Promise<unknown>
    remove: (ctx: SymfonyState & { resourceName: string }, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'symfony',
    setup: config => {
        const baseUrl = config.baseUrl.replace(/\/$/, '')
        return {
            baseUrl,
            buildHeaders: async contentType => ({
                'Content-Type': contentType,
                Accept: 'application/ld+json',
                ...(await resolveHeaders(config.headers)),
            }),
        }
    },
    methods: {
        get: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${ctx.resourceName}${toQuery(payload)}`
            const body = await request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
            return unwrapCollection(body)
        },
        find: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
        },
        create: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${ctx.resourceName}`
            return request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders('application/ld+json'),
                body: JSON.stringify(payload ?? {}),
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders('application/merge-patch+json'),
                body: JSON.stringify(body),
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            const response = await fetch(url, {
                method: 'DELETE',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return { success: true }
        },
    },
})

// Factory returning a symfony driver carrying the `__apiUri` phantom marker, so
// the typed SDK resolves each resource to SymfonyResourceApi<T>.
export function createSymfonyDriver(
    config: SymfonyConfig,
): ReturnType<typeof symfonyDriver> & { __apiUri: 'symfony' } {
    return symfonyDriver(config) as ReturnType<typeof symfonyDriver> & { __apiUri: 'symfony' }
}
