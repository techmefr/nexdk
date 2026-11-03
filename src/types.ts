import type { StandardSchemaV1 } from './standard-schema.ts'

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type SdkEvent =
    | 'request'
    | 'success'
    | 'error'
    | 'data'
    | 'complete'
    | 'connected'
    | 'disconnected'

export type SdkEventHandler = (event: SdkEvent, data?: unknown) => void

export type AnyResource = Resource<StandardSchemaV1>

export interface ResourceConfig<TSchema extends StandardSchemaV1> {
    name: string
    schema: TSchema
    fragments?: Record<string, string[]>
    relations?: Record<string, () => AnyResource>
    validateResponses?: boolean
}

export interface Resource<TSchema extends StandardSchemaV1> {
    name: string
    schema: TSchema
    fragments: Record<string, string[]>
    relations: Record<string, () => AnyResource>
    validateResponses?: boolean
}

export type InferSchema<TResource extends AnyResource> =
    StandardSchemaV1.InferOutput<TResource['schema']>

export type AsyncMethod<TReturn> = (
    payload?: unknown,
    onEvent?: SdkEventHandler,
    extra?: unknown,
) => Promise<TReturn>

export type ReactiveMethod = (
    payload?: unknown,
    onEvent?: SdkEventHandler,
) => () => void

export interface SdkDriver {
    readonly name: string
    bindResource(resourceName: string, resource: AnyResource): void
}

export type DriverResourceProxy<TDriver extends SdkDriver> =
    TDriver & Record<string, unknown>

export type ResourceMap = Record<string, AnyResource>

export type ResourcesByDriver<TDrivers extends Record<string, SdkDriver>> = {
    [K in keyof TDrivers]?: ResourceMap
}

export interface StatusError extends Error {
    status: number
    errors?: unknown
    data?: unknown
}

export interface StatusContext {
    error: StatusError
    driver: string
    resource: string
    method: string
}

export type StatusHandler = (context: StatusContext) => void | Promise<void>

export type StatusHandlers = {
    [status: number]: StatusHandler | undefined
    '4xx'?: StatusHandler
    '5xx'?: StatusHandler
}

export type SdkConfig<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers> = ResourcesByDriver<TDrivers>,
> = {
    drivers: TDrivers
    resources?: TResources
    notify?: SdkEventHandler
    validateResponses?: boolean
    onStatus?: StatusHandlers
    throw?: boolean
}

export type SdkResultError = Error & {
    status?: number
    errors?: unknown
    data?: unknown
}

export type SdkResult<T> =
    | { data: T; error: undefined }
    | { data: undefined; error: SdkResultError }

export type SdkReturn<TThrow extends boolean, T> = TThrow extends true ? T : SdkResult<T>

export type ResourceProxy = Record<string, (...args: unknown[]) => unknown>

export type Sdk<TDrivers extends Record<string, SdkDriver>> = {
    [K in keyof TDrivers]: TDrivers[K] & Record<string, ResourceProxy>
}

export type WriteInput<T> = Partial<T> & Record<string, any>
