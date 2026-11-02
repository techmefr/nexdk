import { toErrorPayload } from './errors.ts'
import { mergeEventHandlers } from './merge.ts'
import { reactToStatus } from './on-status.ts'
import { VALIDATED_METHODS, validateResponse } from './validate-response.ts'
import type {
    AnyResource,
    SdkConfig,
    SdkDriver,
    SdkEventHandler,
    ResourcesByDriver,
    StatusHandlers,
} from './types.ts'
import type { TypedSdk } from './typed-sdk.ts'

const RESERVED_DRIVER_KEYS = new Set(['name', 'bindResource'])

function isDriverMethodName(driver: SdkDriver, name: string | symbol): name is string {
    return (
        typeof name === 'string'
        && !(name in Object.prototype)
        && !RESERVED_DRIVER_KEYS.has(name)
        && typeof (driver as unknown as Record<string, unknown>)[name] === 'function'
    )
}

export function createSdk<
    TDrivers extends Record<string, SdkDriver>,
    TResources extends ResourcesByDriver<TDrivers> = Record<never, never>,
>(config: SdkConfig<TDrivers, TResources>): TypedSdk<TDrivers, TResources> {
    const sdk = {} as Record<string, unknown>
    const globalHandler = config.notify

    for (const key in config.drivers) {
        const driver = config.drivers[key]
        const resources = config.resources?.[key]
        bindDriverResources(key, driver, resources)
        sdk[key] = createDriverProxy(driver, globalHandler, resources, config.validateResponses === true, config.onStatus)
    }

    return sdk as TypedSdk<TDrivers, TResources>
}

function bindDriverResources(
    driverKey: string,
    driver: SdkDriver,
    resources: ResourcesByDriver<Record<string, SdkDriver>>[string] | undefined,
): void {
    if (resources === undefined) return
    for (const resourceName in resources) {
        if (resourceName in driver) {
            throw new Error(
                `Resource "${resourceName}" collides with a member of driver "${driverKey}" (${driver.name}): rename the resource key`,
            )
        }
        const resource = resources[resourceName]
        if (resource !== undefined) {
            driver.bindResource(resourceName, resource)
        }
    }
}

function createDriverProxy<TDriver extends SdkDriver>(
    driver: TDriver,
    globalHandler: SdkEventHandler | undefined,
    resources: Record<string, AnyResource> | undefined,
    validateAll: boolean,
    onStatus: StatusHandlers | undefined,
): TDriver {
    return new Proxy(driver, {
        get(target, prop: string | symbol) {
            if (typeof prop === 'symbol' || prop in Object.prototype) {
                return Reflect.get(target, prop)
            }
            if (prop in target) {
                const value = (target as unknown as Record<string, unknown>)[prop]
                return typeof value === 'function' ? value.bind(target) : value
            }

            const resource = resources?.[prop]
            const validate = resource !== undefined && (resource.validateResponses ?? validateAll)
            return createResourceProxy(target, prop, globalHandler, validate ? resource : undefined, onStatus)
        },
    })
}

function createResourceProxy(
    driver: SdkDriver,
    resourceName: string,
    globalHandler: SdkEventHandler | undefined,
    validated: AnyResource | undefined,
    onStatus: StatusHandlers | undefined,
): unknown {
    return new Proxy(
        {},
        {
            get(_target, methodName: string | symbol) {
                if (typeof methodName === 'symbol' || methodName in Object.prototype) return undefined

                return (payload?: unknown, onEvent?: unknown, extra?: unknown) => {
                    if (!isDriverMethodName(driver, methodName)) {
                        throw new Error(
                            `Driver "${driver.name}" has no method "${methodName}" for resource "${resourceName}"`,
                        )
                    }

                    const method = (driver as unknown as Record<string, unknown>)[methodName]

                    const handler = mergeEventHandlers(
                        globalHandler,
                        onEvent as SdkEventHandler | undefined,
                    )

                    const react = (error: unknown): Promise<void> | undefined =>
                        onStatus === undefined
                            ? undefined
                            : reactToStatus(onStatus, error, { driver: driver.name, resource: resourceName, method: methodName })

                    let result: unknown
                    try {
                        result = (method as (...args: unknown[]) => unknown).call(driver, resourceName, payload, handler, extra)
                    } catch (error) {
                        void react(error)
                        throw error
                    }
                    if (!(result instanceof Promise)) return result

                    const settled =
                        validated === undefined || !VALIDATED_METHODS.has(methodName)
                            ? result
                            : result.then(async value => {
                                  try {
                                      return await validateResponse(validated, methodName, value)
                                  } catch (error) {
                                      handler?.('error', toErrorPayload(error))
                                      throw error
                                  }
                              })
                    if (onStatus === undefined) return settled
                    return settled.catch(async (error: unknown) => {
                        await react(error)
                        throw error
                    })
                }
            },
        },
    )
}
