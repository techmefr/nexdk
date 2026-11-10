import type { FetchLike, HeadersResolver, SdkCallOptions, SdkEventHandler, SdkReturn, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface StrapiConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export interface StrapiIdPayload {
    id: string | number
}

export type StrapiUpdatePayload = StrapiIdPayload & Record<string, unknown>

export interface StrapiListQuery {
    filters?: Record<string, unknown>
    sort?: string | string[]
    populate?: string | string[] | Record<string, unknown>
    fields?: string[]
    pagination?: { page?: number; pageSize?: number; start?: number; limit?: number }
    locale?: string
}

export interface StrapiRemoveResult {
    success: boolean
}

export interface StrapiPagination {
    page?: number
    pageSize?: number
    pageCount?: number
    start?: number
    limit?: number
    total?: number
}

export type StrapiCollection<T> = T[] & { readonly pagination?: StrapiPagination }

export interface StrapiResourceApi<T, TThrow extends boolean = false> {
    get(query?: StrapiListQuery, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, StrapiCollection<T>>>
    find(payload: StrapiIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    create(body: WriteInput<T>, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    update(payload: StrapiUpdatePayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    remove(payload: StrapiIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, StrapiRemoveResult>>
}
