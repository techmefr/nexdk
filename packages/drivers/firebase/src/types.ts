import type { FetchLike, HeadersResolver, SdkEventHandler, WriteInput } from 'nexdk'

export type { HeadersResolver }

export interface FirebaseConfig {
    projectId: string
    databaseId?: string
    baseUrl?: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
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

export interface FirebaseResourceApi<T> {
    get(query?: FirebaseListQuery, onEvent?: SdkEventHandler): Promise<FirebasePage<T>>
    find(payload: FirebaseIdPayload, onEvent?: SdkEventHandler): Promise<T>
    create(body: WriteInput<T> & { id?: string }, onEvent?: SdkEventHandler): Promise<T>
    update(payload: FirebaseUpdatePayload, onEvent?: SdkEventHandler): Promise<T>
    remove(payload: FirebaseIdPayload, onEvent?: SdkEventHandler): Promise<FirebaseRemoveResult>
}
