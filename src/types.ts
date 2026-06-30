import type { PilotaEventHandler } from '@pilota/core'

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

// Per-resource API surface the supabase driver exposes through the SDK,
// parameterized by the resource's inferred record type `T`. Core reads this via
// the driver's phantom `__resourceApi` marker.
export interface SupabaseResourceApi<T> {
    get(payload?: object, onEvent?: PilotaEventHandler): Promise<SupabaseResult<T>>
    insert(payload?: object, onEvent?: PilotaEventHandler): Promise<SupabaseResult<T>>
    update(payload?: object, onEvent?: PilotaEventHandler): Promise<SupabaseResult<T>>
    remove(payload?: object, onEvent?: PilotaEventHandler): Promise<SupabaseResult<never>>
    subscribe(payload?: object, onEvent?: PilotaEventHandler): () => void
}
