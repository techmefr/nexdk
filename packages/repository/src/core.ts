import { SdkError } from 'nexdk'

export const DEFAULT_PER_PAGE = 20

export interface Paging {
    page: number
    perPage: number
}

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
    const resolved = value ?? fallback
    if (!Number.isInteger(resolved) || resolved < 1) throw new RangeError(`${label} must be a positive integer`)
    return resolved
}

export function paging(options: { page?: number; perPage?: number }): Paging {
    return {
        page: positiveInteger(options.page, 1, 'page'),
        perPage: positiveInteger(options.perPage, DEFAULT_PER_PAGE, 'perPage'),
    }
}

export function totalOf(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function notFound(): SdkError {
    return new SdkError('Not Found', { status: 404 })
}
