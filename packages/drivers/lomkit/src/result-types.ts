import type { LomkitMeta, LomkitRow } from './gate-types.ts'
import type { LomkitKey } from './mutation-types.ts'

export interface LomkitGetResult<T, E extends object = {}> {
    data: LomkitRow<T & E>[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
    from?: number | null
    to?: number | null
    meta?: LomkitMeta
}

export interface LomkitMutateResult {
    created: LomkitKey[]
    updated: LomkitKey[]
}

export interface LomkitBulkResult<T> {
    data: T[]
    meta?: LomkitMeta
}

export type LomkitDeleteResult<T = Record<string, unknown>> = LomkitBulkResult<T>

export interface LomkitActionResult {
    data: {
        impacted: number
    }
}

export interface LomkitActionDetails {
    name: string
    uriKey: string
    fields: Record<string, unknown>
    meta: Record<string, unknown>
    standalone: boolean
    targeted: boolean
}

export interface LomkitInstructionDetails {
    name: string
    uriKey: string
    fields: Record<string, unknown>
    meta: Record<string, unknown>
}

export interface LomkitRelationDetails {
    resource: string
    relation: string
    name: string
    constraints: {
        required_on_creation: boolean
        prohibited_on_creation: boolean
        required_on_update: boolean
        prohibited_on_update: boolean
    }
}

export interface LomkitDetails {
    actions: LomkitActionDetails[]
    instructions: LomkitInstructionDetails[]
    scout_instructions: LomkitInstructionDetails[]
    fields: string[]
    scout_fields: string[]
    limits: number[]
    scopes: string[]
    relations: LomkitRelationDetails[]
    rules: {
        all: Record<string, unknown>
        create: Record<string, unknown>
        update: Record<string, unknown>
    }
}

export interface LomkitDetailsResult {
    data: LomkitDetails
}

export interface LomkitValidationError {
    message: string
    errors: Record<string, string[]>
}
