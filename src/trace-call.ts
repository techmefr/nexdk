import { toErrorPayload } from './errors.ts'
import type { ErrorEventPayload } from './errors.ts'
import type { SdkEventHandler } from './types.ts'

export interface TracedCall {
    emit: SdkEventHandler | undefined
    resource: string
    payload: unknown
    describeError?: (error: unknown) => ErrorEventPayload
}

export function traceCall<T>(call: TracedCall, run: () => T): T {
    const { emit } = call
    const describe = call.describeError ?? toErrorPayload
    emit?.('request', { resource: call.resource, payload: call.payload })
    let result: T
    try {
        result = run()
    } catch (error) {
        emit?.('error', describe(error))
        throw error
    }

    if (typeof result === 'function') return result

    if (result instanceof Promise) {
        return result.then(
            value => {
                emit?.('success', value)
                return value
            },
            (error: unknown) => {
                emit?.('error', describe(error))
                throw error
            },
        ) as T
    }

    emit?.('success', result)
    return result
}
