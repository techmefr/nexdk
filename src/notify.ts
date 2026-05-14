import type { PilotaEventHandler } from '@pilota/core'

export type PilotaNotifyAdapter = {
    onRequest?: (context: { resource?: string; payload?: unknown }) => void
    onSuccess?: (data?: unknown) => void
    onError?: (error: { message: string; errors?: Record<string, string[]> }) => void
    onData?: (data?: unknown) => void
}

export function createNotify(adapter: PilotaNotifyAdapter): PilotaEventHandler {
    return (event: string, data?: unknown) => {
        if (event === 'request') {
            adapter.onRequest?.(data as { resource?: string; payload?: unknown } ?? {})
        }
        if (event === 'success') {
            adapter.onSuccess?.(data)
        }
        if (event === 'error') {
            const err = (data ?? {}) as { message?: string; errors?: Record<string, string[]> }
            adapter.onError?.({ message: err.message ?? 'Unknown error', errors: err.errors })
        }
        if (event === 'data') {
            adapter.onData?.(data)
        }
    }
}
