import { defineDriver } from 'nexdk'
import { createRequest, encodeId, encodeResource, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { HttpRequest } from '@nexdk/http'
import type { SymfonyConfig, SymfonyIdPayload, SymfonyResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        symfony: SymfonyResourceApi<T>
    }
}

interface SymfonyState {
    baseUrl: string
    buildHeaders: (contentType: string, forceContentType?: boolean) => Promise<Record<string, string>>
    request: HttpRequest
}

function unwrapCollection(body: unknown): unknown {
    if (body && typeof body === 'object') {
        const hydra = body as Record<string, unknown>
        const members = 'hydra:member' in hydra ? hydra['hydra:member'] : hydra.member
        if (Array.isArray(members)) {
            const pagination = {
                totalItems: hydra['hydra:totalItems'] ?? hydra.totalItems,
                view: hydra['hydra:view'] ?? hydra.view,
            }
            return Object.defineProperty(members, 'pagination', { value: pagination, enumerable: false })
        }
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
            request: createRequest(config.fetch, { timeout: config.timeout, signal: config.signal }),
            buildHeaders: async (contentType, forceContentType = false) => {
                const custom = await resolveHeaders(config.headers)
                if (!forceContentType) return { 'Content-Type': contentType, Accept: 'application/ld+json', ...custom }
                const others = Object.entries(custom).filter(([name]) => name.toLowerCase() !== 'content-type')
                return { Accept: 'application/ld+json', ...Object.fromEntries(others), 'Content-Type': contentType }
            },
        }
    },
    methods: {
        get: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}${toQuery(payload)}`
            const body = await ctx.request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
            return unwrapCollection(body)
        },
        find: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            return ctx.request(url, {
                method: 'GET',
                headers: await ctx.buildHeaders('application/ld+json'),
            })
        },
        create: async (ctx, payload) => {
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}`
            return ctx.request(url, {
                method: 'POST',
                headers: await ctx.buildHeaders('application/ld+json'),
                body: payload ?? {},
            })
        },
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            return ctx.request(url, {
                method: 'PATCH',
                headers: await ctx.buildHeaders('application/merge-patch+json', true),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as SymfonyIdPayload
            const url = `${ctx.baseUrl}/${encodeResource(ctx.resourceName)}/${encodeId(id)}`
            await ctx.request(url, {
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
