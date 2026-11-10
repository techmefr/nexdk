import { anySignal } from 'nexdk'

export interface RequestSignal {
    signal: AbortSignal | undefined
    clearTimeout: () => void
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
    if (!timeout) return { signal, clearTimeout: () => undefined }
    const timed = timeoutSignal(timeout)
    return { signal: anySignal(signal, timed.signal), clearTimeout: () => clearTimeout(timed.timer) }
}
