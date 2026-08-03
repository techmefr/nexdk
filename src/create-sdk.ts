import { mergeEventHandlers } from './merge.ts'
import type {
    SdkConfig,
    SdkDriver,
    SdkEventHandler,
    ResourcesByDriver,
} from './types.ts'
import type { TypedSdk } from './typed-sdk.ts'

export function createSdk<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers> = Record<never, never>,
>(config: SdkConfig<TDrivers, TResources>): TypedSdk<TDrivers, TResources> {
    const sdk = {} as Record<string, unknown>
    const globalHandler = config.notify

    for (const key in config.drivers) {
        const driver = config.drivers[key]
        bindDriverResources(driver, config.resources?.[key])
        sdk[key] = createDriverProxy(driver, globalHandler)
    }

    return sdk as TypedSdk<TDrivers, TResources>
}

function bindDriverResources(
    driver: SdkDriver,
    resources: ResourcesByDriver<Record<string, SdkDriver>>[string] | undefined,
): void {
    if (resources === undefined) return
    for (const resourceName in resources) {
        const resource = resources[resourceName]
        if (resource !== undefined) {
            driver.bindResource(resourceName, resource)
        }
    }
}

function createDriverProxy<TDriver extends SdkDriver>(
    driver: TDriver,
    globalHandler?: SdkEventHandler,
): TDriver {
    return new Proxy(driver, {
        get(target, prop: string) {
            if (prop in target) {
                const value = (target as Record<string, unknown>)[prop]
                return typeof value === 'function' ? value.bind(target) : value
            }

            return createResourceProxy(target, prop, globalHandler)
        },
    })
}

function createResourceProxy(
    driver: SdkDriver,
    resourceName: string,
    globalHandler?: SdkEventHandler,
): unknown {
    return new Proxy(
        {},
        {
            get(_target, methodName: string) {
                return (payload?: unknown, onEvent?: unknown, mock?: unknown) => {
                    const method = (driver as unknown as Record<string, unknown>)[methodName]

                    if (typeof method !== 'function') {
                        throw new Error(
                            `Driver "${driver.name}" has no method "${methodName}" for resource "${resourceName}"`,
                        )
                    }

                    const handler = mergeEventHandlers(
                        globalHandler,
                        onEvent as SdkEventHandler | undefined,
                    )

                    return (method as (...args: unknown[]) => unknown).call(driver, resourceName, payload, handler, mock)
                }
            },
        },
    )
}
