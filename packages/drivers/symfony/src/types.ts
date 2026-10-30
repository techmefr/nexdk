import type { HeadersResolver, SdkEventHandler } from 'nexdk'

export type { HeadersResolver }

export interface SymfonyConfig {
    baseUrl: string
    headers?: HeadersResolver
}

export interface SymfonyIdPayload {
    id: number | string
}

export type SymfonyUpdatePayload = SymfonyIdPayload & Record<string, unknown>

export interface SymfonyRemoveResult {
    success: boolean
}

export interface SymfonyResourceApi<T> {
    get(
        query?: Record<string, unknown>,
        onEvent?: SdkEventHandler,
    ): Promise<T[]>
    find(
        payload: SymfonyIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<T>
    create(
        body: Partial<T>,
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
