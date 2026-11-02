import { defineDriver } from 'nexdk'
import { HttpError, createRequest, encodeId, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { HttpRequest } from '@nexdk/http'
import type { PocketbaseConfig, PocketbaseIdPayload, PocketbaseResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        pocketbase: PocketbaseResourceApi<T>
    }
}

interface PocketbaseState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
    request: HttpRequest
}

interface PocketbaseList {
    items: unknown[]
    totalPages?: number
    perPage?: number
}

const REJECTED_PREFIX = 'PocketBase rejected the request: '

function explainRejections(request: HttpRequest): HttpRequest {
    return async (url, init) => {
        try {
            return await request(url, init)
        } catch (error) {
            if (error instanceof HttpError && error.status === 400 && error.errors === undefined) {
                throw new HttpError(400, error.data, `${REJECTED_PREFIX}${error.message}`)
            }
            throw error
        }
    }
}

type Ctx = PocketbaseState & { resourceName: string }

const recordsUrl = (ctx: Ctx): string =>
    `${ctx.baseUrl}/api/collections/${encodeURIComponent(ctx.resourceName)}/records`

export const pocketbaseDriver = defineDriver<PocketbaseConfig, PocketbaseState, {
    get: (ctx: Ctx, payload: unknown) => Promise<unknown>
    find: (ctx: Ctx, payload: unknown) => Promise<unknown>
    create: (ctx: Ctx, payload: unknown) => Promise<unknown>
    update: (ctx: Ctx, payload: unknown) => Promise<unknown>
    remove: (ctx: Ctx, payload: unknown) => Promise<{ success: boolean }>
}>({
    name: 'pocketbase',
    setup: config => ({
        baseUrl: config.baseUrl.replace(/\/$/, ''),
        request: explainRejections(createRequest(config.fetch)),
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
            const fetchPage = (extra: Record<string, unknown>): Promise<PocketbaseList> =>
                ctx.request<PocketbaseList>(`${recordsUrl(ctx)}${toQuery({ ...query, ...extra })}`, {
                    method: 'GET',
                    headers,
                })

            if (query.page !== undefined || query.perPage !== undefined) {
                return (await fetchPage({})).items
            }

            const first = await fetchPage({})
            const items: unknown[] = [...first.items]
            const perPage = first.perPage ?? first.items.length
            const totalPages = first.totalPages ?? 1
            if (totalPages > 0) {
                for (let page = 2; page <= totalPages; page++) {
                    items.push(...(await fetchPage({ page })).items)
                }
                return items
            }
            let last = first.items
            for (let page = 2; perPage > 0 && last.length >= perPage; page++) {
                last = (await fetchPage({ page })).items
                items.push(...last)
            }
            return items
        },
        find: async (ctx, payload) => {
            const { id } = payload as PocketbaseIdPayload
            return ctx.request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'GET',
                headers: await ctx.buildHeaders(),
            })
        },
        create: async (ctx, payload) =>
            ctx.request(recordsUrl(ctx), {
                method: 'POST',
                headers: await ctx.buildHeaders(),
                body: payload ?? {},
            }),
        update: async (ctx, payload) => {
            const { id, body } = splitId(payload)
            return ctx.request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'PATCH',
                headers: await ctx.buildHeaders(),
                body,
            })
        },
        remove: async (ctx, payload) => {
            const { id } = payload as PocketbaseIdPayload
            await ctx.request(`${recordsUrl(ctx)}/${encodeId(id)}`, {
                method: 'DELETE',
                headers: await ctx.buildHeaders(),
            })
            return { success: true }
        },
    },
})

export function createPocketbaseDriver(
    config: PocketbaseConfig,
): ReturnType<typeof pocketbaseDriver> & { __apiUri: 'pocketbase' } {
    return pocketbaseDriver(config) as ReturnType<typeof pocketbaseDriver> & { __apiUri: 'pocketbase' }
}
