import type { PilotaEventHandler } from 'beepr'

// Request headers may be a static object or a resolver function called before
// every request, so callers can supply a fresh (e.g. refreshed) bearer token.
export type HeadersResolver = Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)

export interface LomkitConfig {
    baseUrl: string
    headers?: HeadersResolver
}

export interface LomkitPaginationMeta {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

export interface LomkitGetResult<T> {
    data: T[]
    meta?: LomkitPaginationMeta
}

export interface LomkitMutateResult<T> {
    data: T[]
}

export interface LomkitDeleteResult {
    success: boolean
}

export interface LomkitValidationError {
    message: string
    errors: Record<string, string[]>
}

// Per-resource API surface the lomkit driver exposes through the SDK,
// parameterized by the resource's inferred record type `T`. Core reads this via
// the driver's phantom `__resourceApi` marker to type each resource end-to-end.
export interface LomkitResourceApi<T> {
    get(
        payload?: object,
        onEvent?: PilotaEventHandler,
        mock?: T | T[],
    ): Promise<LomkitGetResult<T>>
    mutate(
        payload?: object,
        onEvent?: PilotaEventHandler,
        mock?: T | T[],
    ): Promise<LomkitMutateResult<T>>
    delete(
        payload: { resources: (number | string)[] },
        onEvent?: PilotaEventHandler,
    ): Promise<LomkitDeleteResult>
}
