import type { SdkEventHandler } from 'nexdk'
import type { FetchLike, HeadersResolver } from '@nexdk/http'
import type { LomkitSearchPayload } from './search-types.ts'
import type { LomkitActionPayload, LomkitBulkPayload, LomkitMutatePayload } from './mutation-types.ts'
import type {
    LomkitActionResult,
    LomkitBulkResult,
    LomkitDeleteResult,
    LomkitDetailsResult,
    LomkitGetResult,
    LomkitMutateResult,
} from './result-types.ts'

export type * from './gate-types.ts'
export type * from './search-types.ts'
export type * from './mutation-types.ts'
export type * from './result-types.ts'

export interface LomkitConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export interface LomkitResourceApi<T> {
    get<E extends object = {}>(
        payload?: LomkitSearchPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T, E>>
    mutate(
        payload?: LomkitMutatePayload<T> | LomkitMutatePayload<T>[],
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult>
    delete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult>
    restore(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>>
    forceDelete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>>
    actions(
        payload: LomkitActionPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitActionResult>
    details(
        payload?: undefined,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDetailsResult>
}
