import type {
    AnyResource,
    InferSchema,
    SdkDriver,
    ResourceProxy,
    ResourcesByDriver,
} from './types.ts'

export interface ResourceApiKinds<T> {
    readonly __sdk?: T
}

export type ResourceApiUri = Exclude<keyof ResourceApiKinds<unknown>, '__sdk'>

export type ResourceApiFor<TDriver, T> = TDriver extends {
    __apiUri: infer U extends ResourceApiUri
}
    ? ResourceApiKinds<T>[U]
    : Record<string, never>

type TypedDriverSlice<TDriver extends SdkDriver, TResources> = [
    keyof TResources,
] extends [never]
    ? TDriver & Record<string, ResourceProxy>
    : TDriver & {
          [R in keyof TResources]: TResources[R] extends AnyResource
              ? ResourceApiFor<TDriver, InferSchema<TResources[R]>>
              : never
      }

export type TypedSdk<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers>,
> = {
    [K in keyof TDrivers]: TypedDriverSlice<
        TDrivers[K],
        K extends keyof TResources ? NonNullable<TResources[K]> : Record<never, never>
    >
}
