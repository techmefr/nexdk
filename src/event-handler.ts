import type { PilotaEventHandler } from '@pilota/core'
import type { PilotaEvent, PilotaHooksInstance } from './hooks.ts'

export function resolveEventHandler(
    local: PilotaEventHandler | undefined,
    global: PilotaHooksInstance,
): PilotaEventHandler {
    if (local !== undefined) return local

    return (event: PilotaEvent, data?: unknown) => {
        void global.callHook(event, data)
    }
}
