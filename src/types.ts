import type { PilotaEventHandler } from 'beepr'

// Request headers may be a static object or a resolver function called before
// every request (and on every WS (re)connect), so callers can supply a fresh
// (e.g. refreshed) bearer token.
export type HeadersResolver = Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)

export interface NhostConfig {
    endpoint: string
    adminSecret?: string
    headers?: HeadersResolver
}

export interface GraphQLError {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, unknown>
}

export interface NhostQueryResult<T> {
    data: T | null
    errors?: GraphQLError[]
}

export interface GraphQLOptions {
    fragment?: string
}

export interface UpdateByIdPayload {
    id: string
    data: Record<string, unknown>
}

export interface UpsertPayload {
    data: Record<string, unknown>
    conflictConstraint: string
    updateColumns: string[]
}

export interface UpdateWherePayload {
    where: Record<string, unknown>
    data: Record<string, unknown>
}

export interface DeleteByIdPayload {
    id: string
}

export interface NhostMutationResult<T> {
    data: T | null
    errors?: unknown[]
}

// Per-resource API surface the nhost driver exposes through the SDK.
// `T` is the resource's inferred record type. GraphQL list operations return a
// keyed wrapper (e.g. { products: Product[] }) rather than the record itself,
// so query/subscription accept an explicit `TData` override, defaulting to `T`.
export interface NhostResourceApi<T> {
    query<TData = T>(
        payload?: object,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostQueryResult<TData>>
    mutation<TData = T>(
        payload?: object,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    upsert<TData = T>(
        payload: UpsertPayload,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    updateById<TData = T>(
        payload: UpdateByIdPayload,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    updateWhere(
        payload: UpdateWherePayload,
        onEvent?: PilotaEventHandler,
    ): Promise<{ affectedRows: number }>
    deleteById(
        payload: DeleteByIdPayload,
        onEvent?: PilotaEventHandler,
    ): Promise<{ success: boolean }>
    subscription(
        payload?: object,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): () => void
}
