import type { FetchLike, HeadersResolver, SdkEventHandler, SdkReturn, WriteInput } from 'nexdk'

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

export interface SymfonyResourceApi<T, TThrow extends boolean = false> {
    get(
        query?: Record<string, unknown>,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, SymfonyCollection<T>>>
    find(
        payload: SymfonyIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, T>>
    create(
        body: WriteInput<T>,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, T>>
    update(
        payload: SymfonyUpdatePayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, T>>
    remove(
        payload: SymfonyIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, SymfonyRemoveResult>>
}
