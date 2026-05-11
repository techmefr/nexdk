export interface NhostConfig {
    endpoint: string
    adminSecret?: string
    headers?: Record<string, string>
}

export interface GraphQLError {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, unknown>
}

export interface NhostQueryResult<T> {
    data: T | null
    errors?: GraphQLError[]
}

export interface GraphQLOptions {
    fragment?: string
}
