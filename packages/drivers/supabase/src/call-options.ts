import type { SdkCallOptions } from 'nexdk'

interface CallableBuilder {
    abortSignal(signal: AbortSignal): unknown
    setHeader(name: string, value: string): unknown
}

function callSignal(call: SdkCallOptions): AbortSignal | undefined {
    const timeout = call.timeout ? AbortSignal.timeout(call.timeout) : undefined
    if (call.signal === undefined || timeout === undefined) return call.signal ?? timeout
    return AbortSignal.any([call.signal, timeout])
}

export function withCallOptions<B extends CallableBuilder>(builder: B, options: unknown): B {
    if (options === null || typeof options !== 'object') return builder
    const call = options as SdkCallOptions
    const signal = callSignal(call)
    if (signal !== undefined) builder.abortSignal(signal)
    for (const [name, value] of Object.entries(call.headers ?? {})) builder.setHeader(name, value)
    return builder
}
