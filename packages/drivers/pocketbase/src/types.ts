import type { FetchLike, HeadersResolver, SdkCallOptions, SdkEventHandler, SdkReturn, WriteInput } from 'nexdk'
import type { ResponseHook } from '@nexdk/http'

export type { HeadersResolver }

export interface PocketbaseConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
    onResponse?: ResponseHook
}

export interface PocketbaseIdPayload {
    id: string
}

export type PocketbaseUpdatePayload = PocketbaseIdPayload & Record<string, unknown>

export interface PocketbaseListQuery {
    page?: number
    perPage?: number
    sort?: string
    filter?: string
    expand?: string
    fields?: string
    skipTotal?: boolean | 1
}

export interface PocketbaseRemoveResult {
    success: boolean
}

export interface PocketbasePagination {
    page?: number
    perPage?: number
    totalItems?: number
    totalPages?: number
}

export type PocketbaseCollection<T> = T[] & { readonly pagination?: PocketbasePagination }

export interface PocketbaseResourceApi<T, TThrow extends boolean = false> {
    get(query?: PocketbaseListQuery, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, PocketbaseCollection<T>>>
    find(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    create(body: WriteInput<T>, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    update(payload: PocketbaseUpdatePayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    remove(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, PocketbaseRemoveResult>>
}
