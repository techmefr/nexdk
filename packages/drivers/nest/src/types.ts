import type { HeadersResolver, SdkEventHandler } from 'nexdk'

export type { HeadersResolver }

export interface NestConfig {
    baseUrl: string
    headers?: HeadersResolver
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
        body: Partial<T>,
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
