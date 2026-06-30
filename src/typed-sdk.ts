import type {
    AnyResource,
    InferSchema,
    PilotaDriver,
    ResourceProxy,
    ResourcesByDriver,
} from './types.ts'

// Registry mapping a driver's API "uri" to the per-resource API it exposes,
// parameterized by the resource type `T`. Each driver package augments this
// interface (declaration merging) with one entry, e.g.:
//
//   declare module 'nexdk' {
//       interface ResourceApiKinds<T> {
//           lomkit: LomkitResourceApi<T>
//       }
//   }
//
// This is a higher-kinded-type encoding: the driver advertises a string uri at
// the value level (`__apiUri`) and core looks the API up here with the concrete
// resource type, so `T` flows into the method return types without each app
// hand-writing an interface.
export interface ResourceApiKinds<T> {
    // intentionally empty — augmented per driver package
    readonly __pilota?: T
}

export type ResourceApiUri = Exclude<keyof ResourceApiKinds<unknown>, '__pilota'>

// Recover a driver's per-resource API for a given resource type `T` by reading
// its declared `__apiUri` and looking it up in the registry.
export type ResourceApiFor<TDriver, T> = TDriver extends {
    __apiUri: infer U extends ResourceApiUri
}
    ? ResourceApiKinds<T>[U]
    : Record<string, never>

// The typed SDK slice for one driver: the driver's own members merged with each
// declared resource exposed as that driver's API, parameterized by the
// resource's inferred schema type. Mapping over the known resource keys (not an
// index signature) keeps access total under noUncheckedIndexedAccess.
//
// When a driver declares no resources, fall back to the permissive proxy shape
// so legacy no-resource construction (sdk.driver.anything.method()) still works.
type TypedDriverSlice<TDriver extends PilotaDriver, TResources> = [
    keyof TResources,
] extends [never]
    ? TDriver & Record<string, ResourceProxy>
    : TDriver & {
          [R in keyof TResources]: TResources[R] extends AnyResource
              ? ResourceApiFor<TDriver, InferSchema<TResources[R]>>
              : never
      }

// The fully typed SDK: every driver slice carries exactly its declared
// resources, each typed with that driver's method surface.
export type TypedPilotaSDK<
    TDrivers extends Record<string, PilotaDriver>,
    TResources extends ResourcesByDriver<TDrivers>,
> = {
    [K in keyof TDrivers]: TypedDriverSlice<
        TDrivers[K],
        K extends keyof TResources ? NonNullable<TResources[K]> : Record<never, never>
    >
}
