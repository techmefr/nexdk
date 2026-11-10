import type { SdkErrorKind } from 'nexdk'

export interface RequestSignal {
    signal: AbortSignal | undefined
    dispose: () => void
}

export function anySignal(first: AbortSignal | undefined, second: AbortSignal | undefined): AbortSignal | undefined {
    if (first === undefined) return second
    if (second === undefined || first === second) return first
    return AbortSignal.any([first, second])
}

function timeoutSignal(timeout: number): { signal: AbortSignal; timer: ReturnType<typeof setTimeout> } {
    const controller = new AbortController()
    const timer = setTimeout(() => {
        const error = new Error('[TimeoutError]: The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        Object.assign(error, { code: 23 })
        controller.abort(error)
    }, timeout)
    return { signal: controller.signal, timer }
}

export function requestSignal(signal: AbortSignal | undefined, timeout: number | undefined): RequestSignal {
    if (!timeout) return { signal, dispose: () => undefined }
    const timed = timeoutSignal(timeout)
    return { signal: anySignal(signal, timed.signal), dispose: () => clearTimeout(timed.timer) }
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
