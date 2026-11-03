import { toErrorPayload } from './errors.ts'
import { reactToStatus } from './on-status.ts'
import { VALIDATED_METHODS, validateResponse } from './validate-response.ts'
import type { AnyResource, SdkDriver, SdkEventHandler, StatusHandlers } from './types.ts'

export interface MethodCall {
    driver: SdkDriver
    resourceName: string
    methodName: string
    handler: SdkEventHandler | undefined
    validated: AnyResource | undefined
    onStatus: StatusHandlers | undefined
}

interface HeldSuccess {
    handler: SdkEventHandler | undefined
    release: () => void
}

function holdSuccess(handler: SdkEventHandler | undefined): HeldSuccess {
    if (handler === undefined) return { handler, release: () => undefined }
    let held: { data: unknown } | undefined
    return {
        handler: (event, data) => {
            if (event === 'success') held = { data }
            else handler(event, data)
        },
        release: () => {
            if (held !== undefined) handler('success', held.data)
        },
    }
}

function react(call: MethodCall, error: unknown): Promise<void> | undefined {
    if (call.onStatus === undefined) return undefined
    return reactToStatus(call.onStatus, error, { driver: call.driver.name, resource: call.resourceName, method: call.methodName })
}

async function validated(call: MethodCall, resource: AnyResource, value: unknown, success: HeldSuccess): Promise<unknown> {
    let checked: unknown
    try {
        checked = await validateResponse(resource, call.methodName, value)
    } catch (error) {
        call.handler?.('error', toErrorPayload(error))
        throw error
    }
    success.release()
    return checked
}

export function callMethod(call: MethodCall, payload: unknown, extra: unknown): unknown {
    const method = (call.driver as unknown as Record<string, (...args: unknown[]) => unknown>)[call.methodName]
    const resource = call.validated !== undefined && VALIDATED_METHODS.has(call.methodName) ? call.validated : undefined
    const success = resource === undefined ? { handler: call.handler, release: () => undefined } : holdSuccess(call.handler)

    let result: unknown
    try {
        result = method.call(call.driver, call.resourceName, payload, success.handler, extra)
    } catch (error) {
        void react(call, error)
        throw error
    }
    if (!(result instanceof Promise)) {
        success.release()
        return result
    }

    const settled = resource === undefined ? result : result.then(value => validated(call, resource, value, success))
    if (call.onStatus === undefined) return settled
    return settled.catch(async (error: unknown) => {
        await react(call, error)
        throw error
    })
}
