import { toErrorPayload } from './errors.ts'
import { reactToStatus } from './on-status.ts'
import { callContext } from './trace-call.ts'
import { VALIDATED_METHODS, validateResponse } from './validate-response.ts'
import type { AnyResource, SdkDriver, SdkEventHandler, SdkResult, SdkResultError, StatusHandlers } from './types.ts'

export interface MethodCall {
    driver: SdkDriver
    resourceName: string
    methodName: string
    handler: SdkEventHandler | undefined
    validated: AnyResource | undefined
    onStatus: StatusHandlers | undefined
    throwErrors: boolean
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

interface WatchedEvents {
    handler: SdkEventHandler | undefined
    emitted: () => boolean
    resource: () => string | undefined
}

function requestedResource(data: unknown): string | undefined {
    const resource = data !== null && typeof data === 'object' ? (data as { resource?: unknown }).resource : undefined
    return typeof resource === 'string' ? resource : undefined
}

function watchEvents(handler: SdkEventHandler | undefined): WatchedEvents {
    if (handler === undefined) return { handler, emitted: () => false, resource: () => undefined }
    let emitted = false
    let resource: string | undefined
    return {
        handler: (event, data) => {
            if (event === 'error') emitted = true
            if (event === 'request') resource = requestedResource(data) ?? resource
            handler(event, data)
        },
        emitted: () => emitted,
        resource: () => resource,
    }
}

function react(call: MethodCall, error: unknown): Promise<void> | undefined {
    if (call.onStatus === undefined) return undefined
    return reactToStatus(call.onStatus, error, { driver: call.driver.name, resource: call.resourceName, method: call.methodName })
}

function emitError(call: MethodCall, error: unknown, resource?: string): void {
    call.handler?.('error', { ...toErrorPayload(error), ...callContext(resource ?? call.resourceName, call.methodName) })
}

async function validated(call: MethodCall, resource: AnyResource, value: unknown, success: HeldSuccess, events: WatchedEvents): Promise<unknown> {
    let checked: unknown
    try {
        checked = await validateResponse(resource, call.methodName, value)
    } catch (error) {
        emitError(call, error, events.resource())
        throw error
    }
    success.release()
    return checked
}

function settle(call: MethodCall, settled: Promise<unknown>): Promise<unknown> {
    const reacted = call.onStatus === undefined
        ? settled
        : settled.catch(async (error: unknown) => {
              await react(call, error)
              throw error
          })
    if (call.throwErrors) return reacted
    return reacted.then(
        (data: unknown): SdkResult<unknown> => ({ data, error: undefined }),
        (error: unknown): SdkResult<unknown> => ({ data: undefined, error: error as SdkResultError }),
    )
}

export function failCall(call: MethodCall, error: unknown, resource?: string): Promise<unknown> {
    emitError(call, error, resource)
    return settle(call, Promise.reject(error))
}

export function callMethod(call: MethodCall, payload: unknown, extra: unknown): unknown {
    const method = (call.driver as unknown as Record<string, (...args: unknown[]) => unknown>)[call.methodName]
    const resource = call.validated !== undefined && VALIDATED_METHODS.has(call.methodName) ? call.validated : undefined
    const success = resource === undefined ? { handler: call.handler, release: () => undefined } : holdSuccess(call.handler)
    const events = watchEvents(success.handler)

    let result: unknown
    try {
        result = method.call(call.driver, call.resourceName, payload, events.handler, extra)
    } catch (error) {
        if (call.throwErrors) {
            void react(call, error)
            throw error
        }
        return events.emitted() ? settle(call, Promise.reject(error)) : failCall(call, error, events.resource())
    }
    if (!(result instanceof Promise)) {
        success.release()
        return result
    }

    const settled = resource === undefined ? result : result.then(value => validated(call, resource, value, success, events))
    return settle(call, settled)
}
