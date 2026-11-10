import type { SdkCallOptions, SdkErrorKind } from './types.ts'

export function anySignal(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
    const present = [...new Set(signals.filter((signal): signal is AbortSignal => signal !== undefined))]
    if (present.length < 2) return present[0]
    return AbortSignal.any(present)
}

export function callSignal(options: SdkCallOptions | undefined): AbortSignal | undefined {
    const timeout = options?.timeout ? AbortSignal.timeout(options.timeout) : undefined
    return anySignal(options?.signal, timeout)
}

export function mergeHeaders(
    base: Record<string, string> | undefined,
    extra: Record<string, string> | undefined,
): Record<string, string> {
    if (extra === undefined) return base ?? {}
    const headers = new Headers(base)
    for (const [name, value] of Object.entries(extra)) headers.set(name, value)
    return Object.fromEntries(headers)
}

function named(value: unknown, name: string): boolean {
    return value !== null && typeof value === 'object' && (value as { name?: unknown }).name === name
}

export function failureKind(error: unknown, signal: AbortSignal | undefined): SdkErrorKind {
    if (signal?.aborted) return named(signal.reason, 'TimeoutError') ? 'timeout' : 'abort'
    if (named(error, 'TimeoutError')) return 'timeout'
    if (named(error, 'AbortError')) return 'abort'
    return 'network'
}
