import type { StandardSchemaV1 } from './standard-schema.ts'

// nexdk owns its event contract and depends on nothing. The same tiny union is
// intentionally duplicated in beepr so both packages stay independent; the two
// definitions must remain identical (same members) so their handlers stay
// mutually assignable.
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

// Map of declared resources keyed by the name used in the SDK (cartItems, …).
export type ResourceMap = Record<string, AnyResource>

// The resources passed to createSdk: one record of resources per driver key.
export type ResourcesByDriver<TDrivers extends Record<string, SdkDriver>> = {
    [K in keyof TDrivers]?: ResourceMap
}

export type SdkConfig<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers> = ResourcesByDriver<TDrivers>,
> = {
    drivers: TDrivers
    // Resources keyed by driver name, each a record of resourceName -> Resource.
    // createSdk binds them on the matching driver, so apps never call
    // bindResource manually and declared resources become typed end-to-end.
    resources?: TResources
    notify?: SdkEventHandler
}

export type ResourceProxy = Record<string, (...args: unknown[]) => unknown>

export type Sdk<TDrivers extends Record<string, SdkDriver>> = {
    [K in keyof TDrivers]: TDrivers[K] & Record<string, ResourceProxy>
}
