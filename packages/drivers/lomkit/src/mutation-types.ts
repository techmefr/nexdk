import type { WriteInput } from 'nexdk'
import type { LomkitInstructionField, LomkitSearch } from './search-types.ts'

export type LomkitKey = number | string

export type LomkitRelationAttributes = Record<string, any>

export type LomkitPivot = Record<string, unknown>

export interface LomkitRelationCreate {
    operation: 'create'
    attributes?: LomkitRelationAttributes
    pivot?: LomkitPivot
    relations?: LomkitRelations
}

export interface LomkitRelationUpdate {
    operation: 'update'
    key: LomkitKey | LomkitKey[]
    attributes?: LomkitRelationAttributes
    pivot?: LomkitPivot
    relations?: LomkitRelations
}

export interface LomkitRelationAttach {
    operation: 'attach'
    key: LomkitKey | LomkitKey[]
    pivot?: LomkitPivot
    relations?: LomkitRelations
}

export interface LomkitRelationDetach {
    operation: 'detach'
    key: LomkitKey | LomkitKey[]
    relations?: LomkitRelations
}

export interface LomkitRelationToggle {
    operation: 'toggle'
    key: LomkitKey | LomkitKey[]
    attributes?: LomkitRelationAttributes
    pivot?: LomkitPivot
    relations?: LomkitRelations
}

export interface LomkitRelationSync {
    operation: 'sync'
    key: LomkitKey | LomkitKey[]
    without_detaching?: boolean
    attributes?: LomkitRelationAttributes
    pivot?: LomkitPivot
    relations?: LomkitRelations
}

export type LomkitRelationOperation =
    | LomkitRelationCreate
    | LomkitRelationUpdate
    | LomkitRelationAttach
    | LomkitRelationDetach
    | LomkitRelationToggle
    | LomkitRelationSync

export type LomkitRelations = Record<string, LomkitRelationOperation | LomkitRelationOperation[]>

export interface LomkitMutatePayload<T> {
    operation?: 'create' | 'update' | (string & {})
    key?: number | string
    attributes?: WriteInput<T>
    relations?: LomkitRelations
    [field: string]: unknown
}

export interface LomkitBulkPayload {
    resources: LomkitKey[]
}

export interface LomkitActionPayload<T = Record<string, unknown>> {
    name: string
    search?: LomkitSearch<T>
    resources?: LomkitKey[]
    fields?: LomkitInstructionField[]
}
