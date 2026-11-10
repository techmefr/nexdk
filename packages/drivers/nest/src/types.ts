import type { FetchLike, HeadersResolver, SdkCallOptions, SdkEventHandler, SdkReturn, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface NestConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export interface NestIdPayload {
    id: number | string
}

export type NestUpdatePayload = NestIdPayload & Record<string, unknown>

export interface NestRemoveResult {
    success: boolean
}

export interface NestResourceApi<T, TThrow extends boolean = false> {
    get(
        query?: Record<string, unknown>,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SdkReturn<TThrow, T[]>>
    find(
        payload: NestIdPayload,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SdkReturn<TThrow, T>>
    create(
        body: WriteInput<T>,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SdkReturn<TThrow, T>>
    update(
        payload: NestUpdatePayload,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SdkReturn<TThrow, T>>
    remove(
        payload: NestIdPayload,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SdkReturn<TThrow, NestRemoveResult>>
}
