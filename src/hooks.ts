import { createHooks } from 'hookable'

export type PilotaEvent =
    | 'request'
    | 'success'
    | 'error'
    | 'data'
    | 'connected'
    | 'disconnected'

export type PilotaHookMap = {
    [K in PilotaEvent]: (data?: unknown) => void
}

export function createPilotaHooks() {
    return createHooks<PilotaHookMap>()
}

export type PilotaHooksInstance = ReturnType<typeof createPilotaHooks>
