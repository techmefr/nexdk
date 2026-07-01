import type { NhostConfig } from './types.ts'
import { nhostDriver } from './driver.ts'

// The defineDriver-built driver, carrying the `__apiUri` phantom marker so the
// typed SDK resolves each resource to NhostResourceApi<T>.
type NhostDriverInstance = ReturnType<typeof nhostDriver> & { __apiUri: 'nhost' }

// Construct signature preserving the historical `new NhostDriver(config)` call
// site while the driver itself is assembled by defineDriver.
interface NhostDriverConstructor {
    new (config: NhostConfig): NhostDriverInstance
}

// A JS constructor that returns an object yields that object from `new`, so
// `new NhostDriver(config)` produces the defineDriver-built driver unchanged.
export const NhostDriver: NhostDriverConstructor = class {
    constructor(config: NhostConfig) {
        return nhostDriver(config) as NhostDriverInstance
    }
} as unknown as NhostDriverConstructor
