import type { ResourcesByDriver, SdkConfig, SdkDriver } from './types.ts'

export type DefinedSdkConfig<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers>,
    TThrow extends boolean,
> = Omit<SdkConfig<TDrivers, TResources>, 'throw'> & { throw?: TThrow }

export function defineSdkConfig<
    const TDrivers extends Record<string, SdkDriver>,
    const TResources extends ResourcesByDriver<TDrivers> = Record<never, never>,
    const TThrow extends boolean = false,
>(config: SdkConfig<TDrivers, TResources> & { throw?: TThrow }): DefinedSdkConfig<TDrivers, TResources, TThrow> {
    return config
}
