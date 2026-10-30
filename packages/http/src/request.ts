import { FetchError, ofetch } from 'ofetch'

export interface HttpRequestInit {
    method?: string
    headers?: Record<string, string>
    body?: unknown
}

export class HttpError extends Error {
    readonly status: number
    readonly data: unknown

    constructor(status: number, data: unknown, message?: string) {
        super(message ?? `HTTP ${status}`)
        this.name = 'HttpError'
        this.status = status
        this.data = data
    }
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    try {
        return await ofetch<T>(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body as RequestInit["body"],
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
