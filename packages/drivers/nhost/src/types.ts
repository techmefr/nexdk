import type { SdkEventHandler } from 'nexdk'

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
}

export interface NhostResourceApi<T> {
    query<TData = T>(
        payload?: object,
        onEvent?: SdkEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostQueryResult<TData>>
    mutation<TData = T>(
        payload?: object,
        onEvent?: SdkEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    upsert<TData = T>(
        payload: UpsertPayload,
        onEvent?: SdkEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    updateById<TData = T>(
        payload: UpdateByIdPayload,
        onEvent?: SdkEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostMutationResult<TData>>
    updateWhere(
        payload: UpdateWherePayload,
        onEvent?: SdkEventHandler,
    ): Promise<{ affectedRows: number }>
    deleteById(
        payload: DeleteByIdPayload,
        onEvent?: SdkEventHandler,
    ): Promise<{ success: boolean }>
    subscription(
        payload?: object,
        onEvent?: SdkEventHandler,
        options?: GraphQLOptions,
    ): () => void
}
