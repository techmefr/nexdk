import { FetchError, ofetch } from 'ofetch'

export interface HttpRequestInit {
    method?: string
    headers?: Record<string, string>
    body?: unknown
}

// Thrown on a non-2xx response. Carries the parsed body (if any) so a driver
// can special-case a shape (e.g. a 422 validation payload) before deciding
// what to emit on the unified 'error' event.
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

// Perform a JSON request via ofetch, normalizing any non-2xx response into an
// HttpError. Callers throw as-is: defineDriver's wrapper (or a driver's own
// try/catch, for hand-written drivers) turns the throw into the unified
// emit('error') + rethrow contract, so this function never emits anything itself.
export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    try {
        // ofetch retries idempotent methods once by default on a 5xx/network
        // failure. Disabled: the unified driver contract emits one
        // request/success/error per call, and a silent extra network attempt
        // would break that assumption. Drivers wanting retries opt in themselves.
        return await ofetch<T>(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body,
            retry: 0,
        })
    } catch (error) {
        if (error instanceof FetchError) {
            const status = error.status ?? 0
            // A real HTTP status keeps the default "HTTP <status>" message. A
            // status-less failure (DNS/connection error, no response at all)
            // instead surfaces ofetch's own message, which embeds the
            // underlying cause — "HTTP 0" alone would hide it.
            throw new HttpError(status, error.data, status ? undefined : error.message)
        }
        throw error
    }
}
