import type { FetchLike, HeadersResolver, SdkEventHandler, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface PocketbaseConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
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

export interface PocketbaseResourceApi<T> {
    get(query?: PocketbaseListQuery, onEvent?: SdkEventHandler): Promise<PocketbaseCollection<T>>
    find(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler): Promise<T>
    create(body: WriteInput<T>, onEvent?: SdkEventHandler): Promise<T>
    update(payload: PocketbaseUpdatePayload, onEvent?: SdkEventHandler): Promise<T>
    remove(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler): Promise<PocketbaseRemoveResult>
}
