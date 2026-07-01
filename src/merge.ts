import type { PilotaEventHandler } from './types.ts'

// Combine a global and a per-call event handler into one. If either side is
// missing, the other is returned untouched; otherwise both are invoked in order.
export function mergeEventHandlers(
    global: PilotaEventHandler | undefined,
    local: PilotaEventHandler | undefined,
): PilotaEventHandler | undefined {
    if (global === undefined) return local
    if (local === undefined) return global
    return (event, data) => {
        global(event, data)
        local(event, data)
    }
}
