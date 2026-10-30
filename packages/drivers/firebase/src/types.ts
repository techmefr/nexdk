import type { HeadersResolver, SdkEventHandler } from 'nexdk'

export type { HeadersResolver }

export interface FirebaseConfig {
    projectId: string
    databaseId?: string
    baseUrl?: string
    headers?: HeadersResolver
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

export interface FirebaseResourceApi<T> {
    get(query?: FirebaseListQuery, onEvent?: SdkEventHandler): Promise<T[]>
    find(payload: FirebaseIdPayload, onEvent?: SdkEventHandler): Promise<T>
    create(body: Partial<T> & { id?: string }, onEvent?: SdkEventHandler): Promise<T>
    update(payload: FirebaseUpdatePayload, onEvent?: SdkEventHandler): Promise<T>
    remove(payload: FirebaseIdPayload, onEvent?: SdkEventHandler): Promise<FirebaseRemoveResult>
}
