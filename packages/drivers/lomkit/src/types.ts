import type { SdkEventHandler } from 'nexdk'
import type { FetchLike, HeadersResolver } from '@nexdk/http'

export interface LomkitConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export interface LomkitGetResult<T> {
    data: T[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
    from?: number | null
    to?: number | null
    meta?: Record<string, unknown>
}

export interface LomkitMutateResult {
    created: (number | string)[]
    updated: (number | string)[]
}

export interface LomkitDeleteResult {
    success: boolean
}

export interface LomkitValidationError {
    message: string
    errors: Record<string, string[]>
}

export interface LomkitMutatePayload<T> {
    operation?: 'create' | 'update' | (string & {})
    key?: number | string
    attributes?: Partial<T>
    relations?: Record<string, unknown>
    [field: string]: unknown
}

export interface LomkitResourceApi<T> {
    get(
        payload?: object,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T>>
    mutate(
        payload?: LomkitMutatePayload<T> | LomkitMutatePayload<T>[],
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult>
    delete(
        payload: { resources: (number | string)[] },
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult>
}
