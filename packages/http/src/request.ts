import { SdkError } from 'nexdk'
import type { FetchLike } from 'nexdk'
import { isJsonBody, isStreamBody, readBody } from './body.ts'
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

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

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

function requestInit(init: HttpRequestInit | undefined, method: string | undefined): RequestInit {
    const headers = new Headers(init?.headers)
    const options: RequestInit & { duplex?: 'half' } = { method, headers, body: init?.body as RequestInit['body'], signal: init?.signal }
    if (!init?.body || !PAYLOAD_METHODS.has(method ?? 'GET')) return options
    if (isJsonBody(init.body)) {
        const contentType = headers.get('content-type')
        if (typeof init.body !== 'string') {
            options.body = contentType === 'application/x-www-form-urlencoded'
                ? new URLSearchParams(init.body as Record<string, string>).toString()
                : JSON.stringify(init.body)
        }
        if (!contentType) headers.set('content-type', 'application/json')
        if (!headers.has('accept')) headers.set('accept', 'application/json')
    } else if (isStreamBody(init.body as object)) {
        options.duplex = 'half'
    }
    return options
}

function timeoutSignal(timeout: number): { signal: AbortSignal; timer: ReturnType<typeof setTimeout> } {
    const controller = new AbortController()
    const timer = setTimeout(() => {
        const error = new Error('[TimeoutError]: The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        Object.assign(error, { code: 23 })
        controller.abort(error)
    }, timeout)
    return { signal: controller.signal, timer }
}

async function send(url: string, init: HttpRequestInit | undefined, method: string | undefined): Promise<Response> {
    const options = requestInit(init, method)
    const timeout = !options.signal && init?.timeout ? timeoutSignal(init.timeout) : undefined
    if (timeout) options.signal = timeout.signal
    try {
        return await (init?.fetch ?? globalThis.fetch)(url, options)
    } catch (error) {
        const cause = error as Error | undefined
        const detail = cause?.message || cause?.toString() || ''
        throw new HttpError(0, undefined, `[${method ?? 'GET'}] ${JSON.stringify(url)}: <no response>${detail ? ` ${detail}` : ''}`)
    } finally {
        if (timeout) clearTimeout(timeout.timer)
    }
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    const method = init?.method?.toUpperCase()
    const response = await send(url, init, method)
    const data = await readBody(response, method)
    if (response.status >= 400 && response.status < 600) throw new HttpError(response.status, data)
    return data as T
}

export function createRequest(fetchImpl?: FetchLike, options?: HttpRequestOptions): HttpRequest {
    if (fetchImpl === undefined && options === undefined) return request
    return (url, init) => request(url, { ...options, ...init, fetch: fetchImpl })
}
