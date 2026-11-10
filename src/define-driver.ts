import { traceCall } from './trace-call.ts'
import type { AnyResource, SdkCallOptions, SdkDriver, SdkEventHandler } from './types.ts'

export type HeadersResolver =
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>)

export async function resolveHeaders(
    headers: HeadersResolver | undefined,
): Promise<Record<string, string>> {
    if (typeof headers === 'function') return await headers()
    return headers ?? {}
}

export interface DriverMethodContext {
    resourceName: string
    resource: AnyResource | undefined
    emit: SdkEventHandler | undefined
}

export type DriverMethod<TState> = (
    ctx: DriverMethodContext & TState,
    payload: unknown,
    options: SdkCallOptions | undefined,
) => unknown

export interface DriverDefinition<
    TConfig,
    TState,
    TMethods extends Record<string, DriverMethod<TState>>,
> {
    name: string
    setup: (config: TConfig) => TState
    methods: TMethods
    reactive?: ReadonlyArray<keyof TMethods & string>
}

type ProxyMethod = (
    resourceName: string,
    payload?: unknown,
    onEvent?: SdkEventHandler,
    options?: SdkCallOptions,
) => unknown

export type DefinedDriver<TMethods> = SdkDriver & {
    [K in keyof TMethods]: ProxyMethod
}

export function defineDriver<
    TConfig,
    TState,
    TMethods extends Record<string, DriverMethod<TState>>,
>(
    definition: DriverDefinition<TConfig, TState, TMethods>,
): (config: TConfig) => DefinedDriver<TMethods> {
    return (config: TConfig): DefinedDriver<TMethods> => {
        const state = definition.setup(config)
        const resources = new Map<string, AnyResource>()

        const driver: SdkDriver = {
            name: definition.name,
            ...(definition.reactive === undefined ? {} : { reactiveMethods: [...definition.reactive] }),
            bindResource(resourceName, resource) {
                resources.set(resourceName, resource)
            },
        }

        const built = driver as DefinedDriver<TMethods>

        for (const methodName in definition.methods) {
            const method = definition.methods[methodName]
            const proxyMethod: ProxyMethod = (resourceName, payload, onEvent, options) => {
                const ctx = {
                    resourceName,
                    resource: resources.get(resourceName),
                    emit: onEvent,
                    ...state,
                } as DriverMethodContext & TState
                return traceCall({ emit: onEvent, resource: resourceName, method: methodName, payload }, () => method(ctx, payload, options))
            }
            ;(built as Record<string, unknown>)[methodName] = proxyMethod
        }

        return built
    }
}
