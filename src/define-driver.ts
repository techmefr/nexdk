import type { AnyResource, SdkDriver, SdkEventHandler } from './types.ts'

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
    extra: unknown,
) => unknown

export interface DriverDefinition<
    TConfig,
    TState,
    TMethods extends Record<string, DriverMethod<TState>>,
> {
    name: string
    setup: (config: TConfig) => TState
    methods: TMethods
}

type ProxyMethod = (
    resourceName: string,
    payload?: unknown,
    onEvent?: SdkEventHandler,
    extra?: unknown,
) => unknown

export type DefinedDriver<TMethods> = SdkDriver & {
    [K in keyof TMethods]: ProxyMethod
}

export interface ErrorEventPayload {
    message: string
    status?: number
    errors?: unknown
}

function toErrorPayload(error: unknown): ErrorEventPayload {
    if (error instanceof Error) {
        const candidate = error as Error & { status?: unknown; data?: unknown }
        if (error.name === 'HttpError' && typeof candidate.status === 'number') {
            return { message: error.message, status: candidate.status, errors: candidate.data }
        }
        return { message: error.message }
    }
    return { message: String(error) }
}

function isReactiveResult(value: unknown): value is () => void {
    return typeof value === 'function'
}

function runMethod<TState>(
    method: DriverMethod<TState>,
    ctx: DriverMethodContext & TState,
    payload: unknown,
    extra: unknown,
): unknown {
    ctx.emit?.('request', { resource: ctx.resourceName, payload })
    let result: unknown
    try {
        result = method(ctx, payload, extra)
    } catch (error) {
        ctx.emit?.('error', toErrorPayload(error))
        throw error
    }

    if (isReactiveResult(result)) return result

    if (result instanceof Promise) {
        return result.then(
            value => {
                ctx.emit?.('success', value)
                return value
            },
            (error: unknown) => {
                ctx.emit?.('error', toErrorPayload(error))
                throw error
            },
        )
    }

    ctx.emit?.('success', result)
    return result
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
            bindResource(resourceName, resource) {
                resources.set(resourceName, resource)
            },
        }

        const built = driver as DefinedDriver<TMethods>

        for (const methodName in definition.methods) {
            const method = definition.methods[methodName]
            const proxyMethod: ProxyMethod = (resourceName, payload, onEvent, extra) => {
                const ctx = {
                    resourceName,
                    resource: resources.get(resourceName),
                    emit: onEvent,
                    ...state,
                } as DriverMethodContext & TState
                return runMethod(method, ctx, payload, extra)
            }
            ;(built as Record<string, unknown>)[methodName] = proxyMethod
        }

        return built
    }
}
