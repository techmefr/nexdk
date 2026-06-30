import type { ZodTypeAny, z } from 'zod'
import type { PilotaEvent, PilotaEventHandler } from 'beepr'

// The canonical definitions live in beepr; re-exported here for backward-compat.
export type { PilotaEvent, PilotaEventHandler }

export type AnyResource = Resource<ZodTypeAny>

export interface ResourceConfig<TSchema extends ZodTypeAny> {
    name: string
    schema: TSchema
    fragments?: Record<string, string[]>
    relations?: Record<string, () => AnyResource>
}

export interface Resource<TSchema extends ZodTypeAny> {
    name: string
    schema: TSchema
    fragments: Record<string, string[]>
    relations: Record<string, () => AnyResource>
}

export type InferSchema<TResource extends AnyResource> = z.infer<TResource['schema']>

export type AsyncMethod<TReturn> = (
    payload?: unknown,
    onEvent?: PilotaEventHandler,
    mock?: unknown,
) => Promise<TReturn>

export type ReactiveMethod = (
    payload?: unknown,
    onEvent?: PilotaEventHandler,
) => () => void

export interface PilotaDriver {
    readonly name: string
    bindResource(resourceName: string, resource: AnyResource): void
}

export type DriverResourceProxy<TDriver extends PilotaDriver> =
    TDriver & Record<string, unknown>

// Map of declared resources keyed by the name used in the SDK (cartItems, …).
export type ResourceMap = Record<string, AnyResource>

// The resources passed to createPilota: one record of resources per driver key.
export type ResourcesByDriver<TDrivers extends Record<string, PilotaDriver>> = {
    [K in keyof TDrivers]?: ResourceMap
}

export type PilotaConfig<
    TDrivers extends Record<string, PilotaDriver>,
    TResources extends ResourcesByDriver<TDrivers> = ResourcesByDriver<TDrivers>,
> = {
    drivers: TDrivers
    // Resources keyed by driver name, each a record of resourceName -> Resource.
    // createPilota binds them on the matching driver, so apps never call
    // bindResource manually and declared resources become typed end-to-end.
    resources?: TResources
    notify?: PilotaEventHandler
}

export type ResourceProxy = Record<string, (...args: unknown[]) => unknown>

export type PilotaSDK<TDrivers extends Record<string, PilotaDriver>> = {
    [K in keyof TDrivers]: TDrivers[K] & Record<string, ResourceProxy>
}
