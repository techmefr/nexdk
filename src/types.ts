import type { HeadersResolver, PilotaEventHandler } from 'nexdk'

// Re-exported for convenience so consumers can type their own header resolvers.
export type { HeadersResolver }

export interface SymfonyConfig {
    baseUrl: string
    headers?: HeadersResolver
}

// Payload carrying the record id for the by-id verbs.
export interface SymfonyIdPayload {
    id: number | string
}

// update() takes the id plus the fields to merge-patch.
export type SymfonyUpdatePayload = SymfonyIdPayload & Record<string, unknown>

export interface SymfonyRemoveResult {
    success: boolean
}

// Per-resource API surface the symfony driver exposes through the SDK,
// parameterized by the resource's inferred record type `T`. Core reads this via
// the driver's phantom `__apiUri` marker to type each resource end-to-end.
export interface SymfonyResourceApi<T> {
    // GET /{resource} with query params → the Hydra "hydra:member" collection.
    get(
        query?: Record<string, unknown>,
        onEvent?: PilotaEventHandler,
        mock?: T | T[],
    ): Promise<T[]>
    // GET /{resource}/{id} → a single JSON-LD record.
    find(
        payload: SymfonyIdPayload,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // POST /{resource} (application/ld+json) → the created record.
    create(
        body: Partial<T>,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // PATCH /{resource}/{id} (application/merge-patch+json) → the updated record.
    update(
        payload: SymfonyUpdatePayload,
        onEvent?: PilotaEventHandler,
        mock?: T,
    ): Promise<T>
    // DELETE /{resource}/{id}.
    remove(
        payload: SymfonyIdPayload,
        onEvent?: PilotaEventHandler,
    ): Promise<SymfonyRemoveResult>
}
