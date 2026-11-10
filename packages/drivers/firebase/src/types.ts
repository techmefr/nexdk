import type { FetchLike, HeadersResolver, ResponseHook, SdkCallOptions, SdkEventHandler, SdkReturn, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface FirebaseConfig {
    projectId: string
    databaseId?: string
    baseUrl?: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
    onResponse?: ResponseHook
}

export interface FirebaseIdPayload {
    id: string
}

export type FirebaseUpdatePayload = FirebaseIdPayload & Record<string, unknown>

export interface FirebaseCreatePayload extends Record<string, unknown> {
    id?: string
}

export interface FirebaseListQuery {
    pageSize?: number
    pageToken?: string
    orderBy?: string
}

export interface FirebaseRemoveResult {
    success: boolean
}

export type FirebasePage<T> = T[] & { readonly nextPageToken?: string }

export interface FirebaseResourceApi<T, TThrow extends boolean = false> {
    get(query?: FirebaseListQuery, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, FirebasePage<T>>>
    find(payload: FirebaseIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    create(body: WriteInput<T> & { id?: string }, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    update(payload: FirebaseUpdatePayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, T>>
    remove(payload: FirebaseIdPayload, onEvent?: SdkEventHandler, options?: SdkCallOptions): Promise<SdkReturn<TThrow, FirebaseRemoveResult>>
}
