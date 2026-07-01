import type { PilotaEventHandler } from 'beepr'
import type { AnyResource, PilotaDriver } from './types.ts'

// Request headers may be a static object or a resolver called before every
// request, so a driver can supply a fresh (e.g. refreshed) bearer token. This
// matches the lomkit/nhost Tier-2 shape; authors reuse it in their config type.
export type HeadersResolver =
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>)

// Resolve a headers config to a plain record, awaiting the function form.
export async function resolveHeaders(
    headers: HeadersResolver | undefined,
): Promise<Record<string, string>> {
    if (typeof headers === 'function') return await headers()
    return headers ?? {}
}

// Base context every author method receives. The object returned by `setup`
// is merged on top of this, so a method sees both the framework-provided
// fields (resourceName, resource, emit) and the driver's own state.
export interface DriverMethodContext {
    // The resource key used in the SDK call (e.g. "cartItems").
    resourceName: string
    // The bound resource, or undefined when the app declared none for this key.
    resource: AnyResource | undefined
    // The (already merged global + local) event handler. Reactive methods use
    // it to emit 'data' / 'connected' / 'disconnected'. Request/success/error
    // around a normal method are emitted by the wrapper — authors need not.
    emit: PilotaEventHandler | undefined
}

// A single author-written method: it receives the context, the call payload and
// the optional mock, and returns either a value/Promise (async method) or an
// unsubscribe function (reactive method). The wrapper tells the two apart.
export type DriverMethod<TState> = (
    ctx: DriverMethodContext & TState,
    payload: unknown,
    mock: unknown,
) => unknown

export interface DriverDefinition<
    TConfig,
    TState,
    TMethods extends Record<string, DriverMethod<TState>>,
> {
    name: string
    // Build the per-driver state from the config (baseUrl, header resolver, …).
    // Its return is spread into every method's ctx.
    setup: (config: TConfig) => TState
    methods: TMethods
}

// The proxy-invoked signature createPilota calls for every method.
type ProxyMethod = (
    resourceName: string,
    payload?: unknown,
    onEvent?: PilotaEventHandler,
    mock?: unknown,
) => unknown

// The built driver: a PilotaDriver plus one proxy-shaped function per method.
export type DefinedDriver<TMethods> = PilotaDriver & {
    [K in keyof TMethods]: ProxyMethod
}

// A function result is treated as a reactive unsubscribe handle and returned
// untouched — no success/error envelope, so subscribe-style methods keep their
// synchronous teardown contract.
function isReactiveResult(value: unknown): value is () => void {
    return typeof value === 'function'
}

// Wrap an author method with the unified event contract:
//   emit('request', { resource, payload }) before
//   → success: emit('success', result) and return it
//   → reactive (returns a function): return the unsubscribe as-is
//   → throw: emit('error', { message }) then rethrow
function runMethod<TState>(
    method: DriverMethod<TState>,
    ctx: DriverMethodContext & TState,
    payload: unknown,
    mock: unknown,
): unknown {
    ctx.emit?.('request', { resource: ctx.resourceName, payload })
    let result: unknown
    try {
        result = method(ctx, payload, mock)
    } catch (error) {
        ctx.emit?.('error', { message: (error as Error).message })
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
                ctx.emit?.('error', { message: (error as Error).message })
                throw error
            },
        )
    }

    ctx.emit?.('success', result)
    return result
}

// Declare a driver by writing only the protocol translation. The helper returns
// an object implementing PilotaDriver (name + bindResource with a private
// resource Map) plus one proxy-shaped function per declared method, each wrapped
// with the unified event contract.
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

        const driver: PilotaDriver = {
            name: definition.name,
            bindResource(resourceName, resource) {
                resources.set(resourceName, resource)
            },
        }

        const built = driver as DefinedDriver<TMethods>

        for (const methodName in definition.methods) {
            const method = definition.methods[methodName]
            const proxyMethod: ProxyMethod = (resourceName, payload, onEvent, mock) => {
                const ctx = {
                    resourceName,
                    resource: resources.get(resourceName),
                    emit: onEvent,
                    ...state,
                } as DriverMethodContext & TState
                return runMethod(method, ctx, payload, mock)
            }
            ;(built as Record<string, unknown>)[methodName] = proxyMethod
        }

        return built
    }
}
