export interface SupabaseConfig {
    url: string
    key: string
}

export interface SupabaseResult<T> {
    data: T[] | null
    error: SupabaseError | null
}

export interface SupabaseError {
    message: string
    code?: string
    details?: string
    hint?: string
}
