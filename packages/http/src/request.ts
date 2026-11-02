import { FetchError, createFetch, ofetch } from 'ofetch'
import { SdkError } from 'nexdk'

export interface HttpRequestInit {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    fetch?: typeof fetch
}

export type HttpRequest = <T>(url: string, init?: HttpRequestInit) => Promise<T>

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function messageFromData(data: unknown): string | undefined {
    return isRecord(data) && typeof data.message === 'string' && data.message !== '' ? data.message : undefined
}

export class HttpError extends SdkError {
    declare readonly status: number

    constructor(status: number, data: unknown, message?: string) {
        super(message ?? messageFromData(data) ?? `HTTP ${status}`, {
            status,
            data,
            errors: isRecord(data) ? data.errors : undefined,
        })
        this.name = 'HttpError'
    }
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    const client = init?.fetch ? createFetch({ fetch: init.fetch }) : ofetch
    try {
        return await client<T>(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body as RequestInit['body'],
            retry: 0,
        })
    } catch (error) {
        if (error instanceof FetchError) {
            const status = error.status ?? 0
            throw new HttpError(status, error.data, status ? undefined : error.message)
        }
        throw error
    }
}

export function createRequest(fetchImpl?: typeof fetch): HttpRequest {
    if (fetchImpl === undefined) return request
    return (url, init) => request(url, { ...init, fetch: fetchImpl })
}
