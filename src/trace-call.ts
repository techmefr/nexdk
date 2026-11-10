import { toErrorPayload } from './errors.ts'
import type { ErrorEventPayload } from './errors.ts'
import type { SdkEventHandler } from './types.ts'

export interface TracedCall {
    emit: SdkEventHandler | undefined
    resource: string
    method?: string
    payload: unknown
    describeError?: (error: unknown) => ErrorEventPayload
}

export interface CallContext {
    resource: string
    method?: string
}

export function callContext(resource: string, method: string | undefined): CallContext {
    return method === undefined ? { resource } : { resource, method }
}

export function traceCall<T>(call: TracedCall, run: () => T): T {
    const { emit } = call
    const context = callContext(call.resource, call.method)
    const describe = call.describeError ?? toErrorPayload
    const fail = (error: unknown): void => emit?.('error', { ...describe(error), ...context })
    emit?.('request', { ...context, payload: call.payload })
    let result: T
    try {
        result = run()
    } catch (error) {
        fail(error)
        throw error
    }

    if (typeof result === 'function') return result

    if (result instanceof Promise) {
        return result.then(
            value => {
                emit?.('success', { ...context, data: value })
                return value
            },
            (error: unknown) => {
                fail(error)
                throw error
            },
        ) as T
    }

    emit?.('success', { ...context, data: result })
    return result
}
