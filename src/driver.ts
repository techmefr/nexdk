import { defineDriver } from 'nexdk'
import { request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { SymfonyConfig, SymfonyIdPayload, SymfonyResourceApi } from './types.ts'

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
                body: payload ?? {},
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders('application/merge-patch+json'),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${ctx.resourceName}/${id}`
            await request(url, {
                method: 'DELETE',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
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
