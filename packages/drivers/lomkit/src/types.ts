import type { SdkEventHandler } from 'nexdk'
import type { HeadersResolver } from '@nexdk/http'

export interface LomkitConfig {
    baseUrl: string
    headers?: HeadersResolver
}

export interface LomkitPaginationMeta {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

export interface LomkitGetResult<T> {
    data: T[]
    meta?: LomkitPaginationMeta
}

export interface LomkitMutateResult<T> {
    data: T[]
}

export interface LomkitDeleteResult {
    success: boolean
}

export interface LomkitValidationError {
    message: string
    errors: Record<string, string[]>
}

export interface LomkitResourceApi<T> {
    get(
        payload?: object,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T>>
    mutate(
        payload?: object,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult<T>>
    delete(
        payload: { resources: (number | string)[] },
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult>
}
