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
    meta?: { pagination?: { pageCount?: number } }
}

const EXPLICIT_PAGINATION_KEYS = ['page', 'pageSize', 'start', 'limit']

function hasExplicitPagination(query: Record<string, unknown>): boolean {
    const pagination = query.pagination
    if (pagination === null || typeof pagination !== 'object') return false
    return EXPLICIT_PAGINATION_KEYS.some(key => (pagination as Record<string, unknown>)[key] !== undefined)
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
            const query = (payload ?? {}) as Record<string, unknown>
            const headers = await ctx.buildHeaders()
            const fetchPage = (page: number | undefined): Promise<StrapiEnvelope> => {
                const pagination = (query.pagination ?? {}) as Record<string, unknown>
                const pageQuery = page === undefined ? query : { ...query, pagination: { ...pagination, page } }
                return request<StrapiEnvelope>(`${collectionUrl(ctx)}${toStrapiQuery(pageQuery)}`, {
                    method: 'GET',
                    headers,
                })
            }

            if (hasExplicitPagination(query)) return (await fetchPage(undefined)).data

            const first = await fetchPage(undefined)
            if (!Array.isArray(first.data)) return first.data
            const items: unknown[] = [...first.data]
            const pageCount = first.meta?.pagination?.pageCount ?? 1
            for (let page = 2; page <= pageCount; page++) {
                const next = await fetchPage(page)
                if (Array.isArray(next.data)) items.push(...next.data)
            }
            return items
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
