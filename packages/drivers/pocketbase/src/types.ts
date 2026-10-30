import type { HeadersResolver, SdkEventHandler } from 'nexdk'

export type { HeadersResolver }

export interface PocketbaseConfig {
    baseUrl: string
    headers?: HeadersResolver
}

export interface PocketbaseIdPayload {
    id: string
}

export type PocketbaseUpdatePayload = PocketbaseIdPayload & Record<string, unknown>

export interface PocketbaseListQuery {
    page?: number
    perPage?: number
    sort?: string
    filter?: string
    expand?: string
    fields?: string
}

export interface PocketbaseRemoveResult {
    success: boolean
}

export interface PocketbaseResourceApi<T> {
    get(query?: PocketbaseListQuery, onEvent?: SdkEventHandler): Promise<T[]>
    find(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler): Promise<T>
    create(body: Partial<T>, onEvent?: SdkEventHandler): Promise<T>
    update(payload: PocketbaseUpdatePayload, onEvent?: SdkEventHandler): Promise<T>
    remove(payload: PocketbaseIdPayload, onEvent?: SdkEventHandler): Promise<PocketbaseRemoveResult>
}
