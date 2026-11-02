import type { FetchLike, HeadersResolver, SdkEventHandler, WriteInput } from 'nexdk'

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

export interface NestResourceApi<T> {
    get(
        query?: Record<string, unknown>,
        onEvent?: SdkEventHandler,
    ): Promise<T[]>
    find(
        payload: NestIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    create(
        body: WriteInput<T>,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    update(
        payload: NestUpdatePayload,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    remove(
        payload: NestIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<NestRemoveResult>
}
