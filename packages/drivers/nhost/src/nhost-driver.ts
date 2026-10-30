import type { NhostConfig } from './types.ts'
import { nhostDriver } from './driver.ts'

type NhostDriverInstance = ReturnType<typeof nhostDriver> & { __apiUri: 'nhost' }

interface NhostDriverConstructor {
    new (config: NhostConfig): NhostDriverInstance
}

export const NhostDriver: NhostDriverConstructor = class {
    constructor(config: NhostConfig) {
        return nhostDriver(config) as NhostDriverInstance
    }
} as unknown as NhostDriverConstructor
