import type { StandardSchemaV1 } from './standard-schema.ts'

export type SdkEvent =
    | 'request'
    | 'success'
    | 'error'
    | 'data'
    | 'connected'
    | 'disconnected'

export type SdkEventHandler = (event: SdkEvent, data?: unknown) => void

export type AnyResource = Resource<StandardSchemaV1>

export interface ResourceConfig<TSchema extends StandardSchemaV1> {
    name: string
    schema: TSchema
    fragments?: Record<string, string[]>
    relations?: Record<string, () => AnyResource>
}

export interface Resource<TSchema extends StandardSchemaV1> {
    name: string
    schema: TSchema
    fragments: Record<string, string[]>
    relations: Record<string, () => AnyResource>
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

export type SdkConfig<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers> = ResourcesByDriver<TDrivers>,
> = {
    drivers: TDrivers
    resources?: TResources
    notify?: SdkEventHandler
}

export type ResourceProxy = Record<string, (...args: unknown[]) => unknown>

export type Sdk<TDrivers extends Record<string, SdkDriver>> = {
    [K in keyof TDrivers]: TDrivers[K] & Record<string, ResourceProxy>
}
