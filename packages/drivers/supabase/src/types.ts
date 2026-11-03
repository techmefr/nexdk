import type { FetchLike, SdkEventHandler, SdkReturn } from 'nexdk'

export interface SupabaseConfig {
    url: string
    key: string
    fetch?: FetchLike
}

export interface SupabaseResult<T> {
    data: T[]
}

export interface SupabaseError {
    message: string
    code?: string
    details?: string | null
    hint?: string | null
}

export interface SupabaseResourceApi<T, TThrow extends boolean = false> {
    get(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, SupabaseResult<T>>>
    insert(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, SupabaseResult<T>>>
    update(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, SupabaseResult<T>>>
    remove(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, { success: boolean }>>
    subscribe(payload?: object, onEvent?: SdkEventHandler): () => void
}
