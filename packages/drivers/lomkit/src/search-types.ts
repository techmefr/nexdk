import type { LomkitGateName } from './gate-types.ts'

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
