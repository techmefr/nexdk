import type { LomkitGateValue } from './types.ts'

export function isGateAllowed(gate: LomkitGateValue | undefined): boolean {
    if (typeof gate === 'boolean') return gate
    return gate?.allowed === true
}
