import { callMethod, failCall } from './call-method.ts'
import { mergeEventHandlers } from './merge.ts'
import type {
    AnyResource,
    SdkCallOptions,
    SdkConfig,
    SdkDriver,
    SdkEventHandler,
    ResourcesByDriver,
    StatusHandlers,
} from './types.ts'
import type { TypedSdk } from './typed-sdk.ts'

const RESERVED_DRIVER_KEYS = new Set(['name', 'bindResource'])

interface CallOptions {
    globalHandler: SdkEventHandler | undefined
    validateAll: boolean
    onStatus: StatusHandlers | undefined
    throwErrors: boolean
}

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
    TThrow extends boolean = false,
>(config: SdkConfig<TDrivers, TResources> & { throw?: TThrow }): TypedSdk<TDrivers, TResources, TThrow> {
    const sdk = {} as Record<string, unknown>
    const options: CallOptions = {
        globalHandler: config.notify,
        validateAll: config.validateResponses === true,
        onStatus: config.onStatus,
        throwErrors: config.throw === true,
    }

    for (const key in config.drivers) {
        const driver = config.drivers[key]
        const resources = config.resources?.[key]
        bindDriverResources(key, driver, resources)
        sdk[key] = createDriverProxy(driver, resources, options)
    }

    return sdk as TypedSdk<TDrivers, TResources, TThrow>
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
    resources: Record<string, AnyResource> | undefined,
    options: CallOptions,
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
            const validate = resource !== undefined && (resource.validateResponses ?? options.validateAll)
            return createResourceProxy(target, prop, validate ? resource : undefined, options)
        },
    })
}

function createResourceProxy(
    driver: SdkDriver,
    resourceName: string,
    validated: AnyResource | undefined,
    options: CallOptions,
): unknown {
    const { onStatus, throwErrors } = options
    return new Proxy(
        {},
        {
            get(_target, methodName: string | symbol) {
                if (typeof methodName === 'symbol' || methodName in Object.prototype) return undefined

                return (payload?: unknown, onEvent?: unknown, callOptions?: SdkCallOptions) => {
                    const handler = mergeEventHandlers(options.globalHandler, onEvent as SdkEventHandler | undefined)
                    const call = { driver, resourceName, methodName, handler, validated, onStatus, throwErrors }
                    if (!isDriverMethodName(driver, methodName)) {
                        const error = new Error(
                            `Driver "${driver.name}" has no method "${methodName}" for resource "${resourceName}"`,
                        )
                        if (throwErrors) throw error
                        return failCall(call, error)
                    }
                    return callMethod(call, payload, callOptions)
                }
            },
        },
    )
}
