import type { HeadersResolver, SdkEventHandler } from 'nexdk'

export type { HeadersResolver }

export interface StrapiConfig {
    baseUrl: string
    headers?: HeadersResolver
}

export interface StrapiIdPayload {
    id: string | number
}

export type StrapiUpdatePayload = StrapiIdPayload & Record<string, unknown>

export interface StrapiListQuery {
    filters?: Record<string, unknown>
    sort?: string | string[]
    populate?: string | string[] | Record<string, unknown>
    fields?: string[]
    pagination?: { page?: number; pageSize?: number; start?: number; limit?: number }
    locale?: string
}

export interface StrapiRemoveResult {
    success: boolean
}

export interface StrapiResourceApi<T> {
    get(query?: StrapiListQuery, onEvent?: SdkEventHandler): Promise<T[]>
    find(payload: StrapiIdPayload, onEvent?: SdkEventHandler): Promise<T>
    create(body: Partial<T>, onEvent?: SdkEventHandler): Promise<T>
    update(payload: StrapiUpdatePayload, onEvent?: SdkEventHandler): Promise<T>
    remove(payload: StrapiIdPayload, onEvent?: SdkEventHandler): Promise<StrapiRemoveResult>
}
