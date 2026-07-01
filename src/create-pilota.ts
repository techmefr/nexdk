import { mergeEventHandlers } from './merge.ts'
import type {
    PilotaConfig,
    PilotaDriver,
    PilotaEventHandler,
    ResourcesByDriver,
} from './types.ts'
import type { TypedPilotaSDK } from './typed-sdk.ts'

export function createPilota<
    TDrivers extends Record<string, PilotaDriver>,
    TResources extends ResourcesByDriver<TDrivers> = Record<never, never>,
>(config: PilotaConfig<TDrivers, TResources>): TypedPilotaSDK<TDrivers, TResources> {
    const sdk = {} as Record<string, unknown>
    const globalHandler = config.notify

    for (const key in config.drivers) {
        const driver = config.drivers[key]
        bindDriverResources(driver, config.resources?.[key])
        sdk[key] = createDriverProxy(driver, globalHandler)
    }

    return sdk as TypedPilotaSDK<TDrivers, TResources>
}

function bindDriverResources(
    driver: PilotaDriver,
    resources: ResourcesByDriver<Record<string, PilotaDriver>>[string] | undefined,
): void {
    if (resources === undefined) return
    for (const resourceName in resources) {
        const resource = resources[resourceName]
        if (resource !== undefined) {
            driver.bindResource(resourceName, resource)
        }
    }
}

function createDriverProxy<TDriver extends PilotaDriver>(
    driver: TDriver,
    globalHandler?: PilotaEventHandler,
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
    driver: PilotaDriver,
    resourceName: string,
    globalHandler?: PilotaEventHandler,
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
                        onEvent as PilotaEventHandler | undefined,
                    )

                    return (method as (...args: unknown[]) => unknown).call(driver, resourceName, payload, handler, mock)
                }
            },
        },
    )
}
