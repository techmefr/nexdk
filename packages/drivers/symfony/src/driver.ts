import { defineDriver } from 'nexdk'
import { encodeId, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { SymfonyConfig, SymfonyIdPayload, SymfonyResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        symfony: SymfonyResourceApi<T>
    }
}

interface SymfonyState {
    baseUrl: string
    buildHeaders: (contentType: string) => Promise<Record<string, string>>
}

function unwrapCollection(body: unknown): unknown {
    if (body && typeof body === 'object') {
        const hydra = body as Record<string, unknown>
        if ('hydra:member' in hydra) return hydra['hydra:member']
        if ('member' in hydra) return hydra.member
    }
    return body
}

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
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}${toQuery(payload)}`
            const body = await request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
            return unwrapCollection(body)
        },
        find: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            return request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
        },
        create: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}`
            return request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders('application/ld+json'),
                body: payload ?? {},
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            return request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders('application/merge-patch+json'),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${encodeURIComponent(ctx.resourceName)}/${encodeId(id)}`
            await request(url, {
                method: 'DELETE',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
            return { success: true }
        },
    },
})

export function createSymfonyDriver(
    config: SymfonyConfig,
): ReturnType<typeof symfonyDriver> & { __apiUri: 'symfony' } {
    return symfonyDriver(config) as ReturnType<typeof symfonyDriver> & { __apiUri: 'symfony' }
}
