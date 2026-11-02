import type { FetchLike, HeadersResolver, SdkEventHandler, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface SymfonyConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export interface SymfonyIdPayload {
    id: number | string
}

export type SymfonyUpdatePayload = SymfonyIdPayload & Record<string, unknown>

export interface SymfonyRemoveResult {
    success: boolean
}

export interface SymfonyPagination {
    totalItems?: number
    view?: Record<string, unknown>
}

export type SymfonyCollection<T> = T[] & { readonly pagination?: SymfonyPagination }

export interface SymfonyResourceApi<T> {
    get(
        query?: Record<string, unknown>,
        onEvent?: SdkEventHandler,
    ): Promise<SymfonyCollection<T>>
    find(
        payload: SymfonyIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    create(
        body: WriteInput<T>,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    update(
        payload: SymfonyUpdatePayload,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    remove(
        payload: SymfonyIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SymfonyRemoveResult>
}
