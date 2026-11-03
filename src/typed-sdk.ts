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

export interface ThrowingResourceApiKinds<T> {
    readonly __sdk?: T
}

export type ResourceApiUri = Exclude<keyof ResourceApiKinds<unknown>, '__sdk'>

type ApiKinds<T, TThrow extends boolean> = TThrow extends true ? ThrowingResourceApiKinds<T> : ResourceApiKinds<T>

export type ResourceApiFor<TDriver, T, TThrow extends boolean = false> = TDriver extends {
    __apiUri: infer U extends ResourceApiUri
}
    ? U extends keyof ApiKinds<T, TThrow>
        ? ApiKinds<T, TThrow>[U]
        : ResourceApiKinds<T>[U]
    : Record<string, never>

type TypedDriverSlice<TDriver extends SdkDriver, TResources, TThrow extends boolean> = [
    keyof TResources,
] extends [never]
    ? TDriver & Record<string, ResourceProxy>
    : TDriver & {
          [R in keyof TResources]: TResources[R] extends AnyResource
              ? ResourceApiFor<TDriver, InferSchema<TResources[R]>, TThrow>
              : never
      }

export type TypedSdk<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers>,
    TThrow extends boolean = false,
> = {
    [K in keyof TDrivers]: TypedDriverSlice<
        TDrivers[K],
        K extends keyof TResources ? NonNullable<TResources[K]> : Record<never, never>,
        TThrow
    >
}
