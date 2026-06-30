import { createHooks } from 'hookable'
import type { PilotaEvent } from '@pilota/core'

export type { PilotaEvent }

export type PilotaHookMap = {
    [K in PilotaEvent]: (data?: unknown) => void
}

export function createPilotaHooks() {
    return createHooks<PilotaHookMap>()
}

export type PilotaHooksInstance = ReturnType<typeof createPilotaHooks>
