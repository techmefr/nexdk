import type { SdkEventHandler } from 'nexdk'

export interface SupabaseConfig {
    url: string
    key: string
    fetch?: typeof fetch
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

export interface SupabaseResourceApi<T> {
    get(payload?: object, onEvent?: SdkEventHandler): Promise<SupabaseResult<T>>
    insert(payload?: object, onEvent?: SdkEventHandler): Promise<SupabaseResult<T>>
    update(payload?: object, onEvent?: SdkEventHandler): Promise<SupabaseResult<T>>
    remove(payload?: object, onEvent?: SdkEventHandler): Promise<{ success: boolean }>
    subscribe(payload?: object, onEvent?: SdkEventHandler): () => void
}
