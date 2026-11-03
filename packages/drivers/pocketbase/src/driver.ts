import { defineDriver } from 'nexdk'
import { HttpError, createRequest, encodeId, encodeResource, resolveHeaders, splitId, toQuery } from '@nexdk/http'
import type { HttpRequest } from '@nexdk/http'
import type { PocketbaseConfig, PocketbaseIdPayload, PocketbaseResourceApi } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        pocketbase: PocketbaseResourceApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        pocketbase: PocketbaseResourceApi<T, true>
    }
}

interface PocketbaseState {
    baseUrl: string
    buildHeaders: () => Promise<Record<string, string>>
    request: HttpRequest
}

interface PocketbaseList {
    items: unknown[]
    page?: number
    totalItems?: number
    totalPages?: number
    perPage?: number
}

function nonNegative(value: number | undefined): number | undefined {
    return typeof value === 'number' && value >= 0 ? value : undefined
}

function withPagination(rows: unknown[], list: PocketbaseList): unknown[] {
    const pagination = {
        page: list.page,
        perPage: list.perPage,
        totalItems: nonNegative(list.totalItems),
        totalPages: nonNegative(list.totalPages),
    }
    return Object.defineProperty(rows, 'pagination', { value: pagination, enumerable: false })
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
    `${ctx.baseUrl}/api/collections/${encodeResource(ctx.resourceName)}/records`

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
        request: explainRejections(createRequest(config.fetch, { timeout: config.timeout, signal: config.signal })),
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
                const single = await fetchPage({})
                return withPagination(single.items, single)
            }

            const first = await fetchPage({})
            const items: unknown[] = [...first.items]
            const perPage = first.perPage ?? first.items.length
            const totalPages = first.totalPages ?? 1
            if (totalPages > 0) {
                for (let page = 2; page <= totalPages; page++) {
                    items.push(...(await fetchPage({ page })).items)
                }
                return withPagination(items, first)
            }
            let last = first.items
            for (let page = 2; perPage > 0 && last.length >= perPage; page++) {
                last = (await fetchPage({ page })).items
                items.push(...last)
            }
            return withPagination(items, first)
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
