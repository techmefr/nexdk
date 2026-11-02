import type { SdkEventHandler, WriteInput } from 'nexdk'
import type { FetchLike, HeadersResolver } from '@nexdk/http'

export interface LomkitConfig {
    baseUrl: string
    headers?: HeadersResolver
    fetch?: FetchLike
    timeout?: number
    signal?: AbortSignal
}

export type LomkitKey = number | string

export type LomkitGateName = 'viewAny' | 'view' | 'create' | 'update' | 'delete' | 'restore' | 'forceDelete'

export interface LomkitGateDetail {
    allowed: boolean
    message: string | null
}

export type LomkitGateValue = boolean | LomkitGateDetail

export interface LomkitGates {
    authorized_to_view?: LomkitGateValue
    authorized_to_create?: LomkitGateValue
    authorized_to_update?: LomkitGateValue
    authorized_to_delete?: LomkitGateValue
    authorized_to_restore?: LomkitGateValue
    authorized_to_force_delete?: LomkitGateValue
    [name: string]: LomkitGateValue | undefined
}

export type LomkitRow<T> = T & { gates?: LomkitGates }

export interface LomkitMeta {
    gates?: LomkitGates
}

export type LomkitField<T> = Extract<keyof T, string> | (string & {})

export type LomkitFilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'not like' | 'in' | 'not in' | (string & {})

export interface LomkitFilter<T = Record<string, unknown>> {
    field?: LomkitField<T>
    operator?: LomkitFilterOperator
    value?: unknown
    type?: 'and' | 'or'
    nested?: LomkitFilter<T>[]
}

export interface LomkitSort<T = Record<string, unknown>> {
    field: LomkitField<T>
    direction?: 'asc' | 'desc'
}

export interface LomkitSelect<T = Record<string, unknown>> {
    field: LomkitField<T>
}

export interface LomkitScope {
    name: string
    parameters?: unknown[]
}

export type LomkitAggregateType = 'count' | 'min' | 'max' | 'avg' | 'sum' | 'exists' | (string & {})

export interface LomkitAggregate {
    relation: string
    type: LomkitAggregateType
    field?: string
    alias?: string
    filters?: LomkitFilter[]
}

export interface LomkitInstructionField {
    name: string
    value?: unknown
}

export interface LomkitInstruction {
    name: string
    fields?: LomkitInstructionField[]
}

export interface LomkitQuery<T = Record<string, unknown>> {
    filters?: LomkitFilter<T>[]
    scopes?: LomkitScope[]
    sorts?: LomkitSort<T>[]
    selects?: LomkitSelect<T>[]
    aggregates?: LomkitAggregate[]
    includes?: LomkitInclude[]
    instructions?: LomkitInstruction[]
    gates?: LomkitGateName[]
    limit?: number
    page?: number
}

export interface LomkitInclude extends LomkitQuery {
    relation: string
    alias?: string
}

export interface LomkitText {
    value?: string | null
    trashed?: 'with' | 'only'
}

export interface LomkitSearch<T = Record<string, unknown>> extends LomkitQuery<T> {
    text?: LomkitText
}

export interface LomkitSearchPayload<T = Record<string, unknown>> {
    search?: LomkitSearch<T>
}

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

export interface LomkitDeleteResult {
    success: boolean
}

export interface LomkitBulkResult<T> {
    data: T[]
    meta?: LomkitMeta
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

export interface LomkitResourceApi<T> {
    get<E extends object = {}>(
        payload?: LomkitSearchPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T, E>>
    mutate(
        payload?: LomkitMutatePayload<T> | LomkitMutatePayload<T>[],
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult>
    delete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult>
    restore(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>>
    forceDelete(
        payload: LomkitBulkPayload,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>>
    actions(
        payload: LomkitActionPayload<T>,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitActionResult>
    details(
        payload?: undefined,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDetailsResult>
}
