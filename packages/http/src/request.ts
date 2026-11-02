import { FetchError, createFetch, ofetch } from 'ofetch'
import { SdkError } from 'nexdk'
import type { FetchLike } from 'nexdk'
import { errorsFromData, messageFromData } from './error-data.ts'

export interface HttpRequestOptions {
    timeout?: number
    signal?: AbortSignal
}

export interface HttpRequestInit extends HttpRequestOptions {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    fetch?: FetchLike
}

export type HttpRequest = <T>(url: string, init?: HttpRequestInit) => Promise<T>

export class HttpError extends SdkError {
    declare readonly status: number

    constructor(status: number, data: unknown, message?: string) {
        super(message ?? messageFromData(data) ?? `HTTP ${status}`, {
            status,
            data,
            errors: errorsFromData(data),
        })
        this.name = 'HttpError'
    }
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    const client = init?.fetch ? createFetch({ fetch: init.fetch as typeof fetch }) : ofetch
    try {
        return await client<T>(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body as RequestInit['body'],
            timeout: init?.timeout,
            signal: init?.signal,
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

export function createRequest(fetchImpl?: FetchLike, options?: HttpRequestOptions): HttpRequest {
    if (fetchImpl === undefined && options === undefined) return request
    return (url, init) => request(url, { ...options, ...init, fetch: fetchImpl })
}
