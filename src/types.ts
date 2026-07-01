import type { HeadersResolver, PilotaEventHandler } from 'nexdk'

// Re-exported for convenience so consumers can type their own header resolvers.
export type { HeadersResolver }

export interface NestConfig {
    baseUrl: string
    headers?: HeadersResolver
}

// Payload carrying the record id for the by-id verbs.
export interface NestIdPayload {
    id: number | string
}

// update() takes the id plus the fields to patch.
export type NestUpdatePayload = NestIdPayload & Record<string, unknown>

export interface NestRemoveResult {
    success: boolean
}

// Per-resource API surface the nest driver exposes through the SDK,
// parameterized by the resource's inferred record type `T`. Core reads this via
// the driver's phantom `__apiUri` marker to type each resource end-to-end.
export interface NestResourceApi<T> {
    // GET /{resource} with query params from the payload → the array.
    get(
        query?: Record<string, unknown>,
        onEvent?: PilotaEventHandler,
        mock?: T | T[],
    ): Promise<T[]>
    // GET /{resource}/{id} → a single record.
    find(
        payload: NestIdPayload,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // POST /{resource} → the created record.
    create(
        body: Partial<T>,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // PATCH /{resource}/{id} → the updated record.
    update(
        payload: NestUpdatePayload,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // DELETE /{resource}/{id}.
    remove(
        payload: NestIdPayload,
        onEvent?: PilotaEventHandler,
    ): Promise<NestRemoveResult>
}
