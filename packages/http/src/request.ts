import { SdkError } from 'nexdk'
import type { FetchLike, ResponseHook, SdkCallOptions, SdkErrorKind } from 'nexdk'
import { isJsonBody, isStreamBody, readBody } from './body.ts'
import { errorsFromData, messageFromData } from './error-data.ts'
import { anySignal, failureKind, requestSignal } from './signals.ts'

export interface HttpRequestOptions {
    timeout?: number
    signal?: AbortSignal
    onResponse?: ResponseHook
}

export interface HttpRequestInit extends HttpRequestOptions {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    fetch?: FetchLike
}

export interface HttpFailure {
    kind: SdkErrorKind
    cause?: unknown
}

export type HttpRequest = <T>(url: string, init?: HttpRequestInit) => Promise<T>

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

export class HttpError extends SdkError {
    declare readonly status: number
    declare readonly kind: SdkErrorKind

    constructor(status: number, data: unknown, message?: string, failure?: HttpFailure) {
        super(message ?? messageFromData(data) ?? `HTTP ${status}`, {
            status,
            data,
            errors: errorsFromData(data),
            kind: failure?.kind ?? (status === 0 ? 'network' : 'http'),
            cause: failure?.cause,
        })
        this.name = 'HttpError'
    }
}

function requestInit(init: HttpRequestInit | undefined, method: string | undefined): RequestInit {
    const headers = new Headers(init?.headers)
    const options: RequestInit & { duplex?: 'half' } = { method, headers, body: init?.body as RequestInit['body'] }
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

function noResponse(error: unknown, signal: AbortSignal | undefined, method: string | undefined, url: string): HttpError {
    const cause = error as Error | undefined
    const detail = cause?.message || cause?.toString() || ''
    const message = `[${method ?? 'GET'}] ${JSON.stringify(url)}: <no response>${detail ? ` ${detail}` : ''}`
    return new HttpError(0, undefined, message, { kind: failureKind(error, signal), cause: error })
}

async function send(url: string, init: HttpRequestInit | undefined, method: string | undefined): Promise<Response> {
    const options = requestInit(init, method)
    const { signal, dispose } = requestSignal(init?.signal, init?.timeout)
    if (signal) options.signal = signal
    try {
        return await (init?.fetch ?? globalThis.fetch)(url, options)
    } catch (error) {
        throw noResponse(error, signal, method, url)
    } finally {
        dispose()
    }
}

async function read(response: Response, init: HttpRequestInit | undefined, method: string | undefined, url: string): Promise<unknown> {
    try {
        return await readBody(response, method)
    } catch (error) {
        throw noResponse(error, init?.signal, method, url)
    }
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    const method = init?.method?.toUpperCase()
    const response = await send(url, init, method)
    if (init?.onResponse) await init.onResponse(response, { url, method: method ?? 'GET' })
    const data = await read(response, init, method, url)
    if (response.status >= 400 && response.status < 600) throw new HttpError(response.status, data)
    return data as T
}

export function createRequest(fetchImpl?: FetchLike, options?: HttpRequestOptions): HttpRequest {
    if (fetchImpl === undefined && options === undefined) return request
    return (url, init) =>
        request(url, {
            ...options,
            ...init,
            signal: anySignal(options?.signal, init?.signal),
            timeout: init?.timeout ?? options?.timeout,
            onResponse: init?.onResponse ?? options?.onResponse,
            fetch: fetchImpl,
        })
}

function mergeHeaders(base: Record<string, string> | undefined, extra: Record<string, string>): Record<string, string> {
    const headers = new Headers(base)
    for (const [name, value] of Object.entries(extra)) headers.set(name, value)
    return Object.fromEntries(headers)
}

export function withCallOptions(httpRequest: HttpRequest, options: unknown): HttpRequest {
    if (options === null || typeof options !== 'object') return httpRequest
    const call = options as SdkCallOptions
    return (url, init) =>
        httpRequest(url, {
            ...init,
            headers: call.headers === undefined ? init?.headers : mergeHeaders(init?.headers, call.headers),
            signal: anySignal(init?.signal, call.signal),
            timeout: call.timeout ?? init?.timeout,
        })
}
