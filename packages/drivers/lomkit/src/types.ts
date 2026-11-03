import type { SdkEventHandler, SdkReturn } from 'nexdk'
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

export interface LomkitResourceApi<T, TThrow extends boolean = false> {
    get<E extends object = {}>(
        payload?: LomkitSearchPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitGetResult<T, E>>>
    mutate(
        payload?: LomkitMutatePayload<T> | LomkitMutatePayload<T>[],
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitMutateResult>>
    delete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitDeleteResult>>
    restore(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitBulkResult<T>>>
    forceDelete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitBulkResult<T>>>
    actions(
        payload: LomkitActionPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitActionResult>>
    details(
        payload?: undefined,
        onEvent?: SdkEventHandler,
    ): Promise<SdkReturn<TThrow, LomkitDetailsResult>>
}
