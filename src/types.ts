export interface LomkitConfig {
    baseUrl: string
    headers?: Record<string, string>
}

export interface LomkitPaginationMeta {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

export interface LomkitGetResult<T> {
    data: T[]
    meta?: LomkitPaginationMeta
}

export interface LomkitMutateResult<T> {
    data: T[]
}

export interface LomkitDeleteResult {
    success: boolean
}

export interface LomkitValidationError {
    message: string
    errors: Record<string, string[]>
}
