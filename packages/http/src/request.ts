import { SdkError, anySignal, callSignal, failureKind, mergeHeaders } from 'nexdk'
import type { FetchLike, ResponseHook, SdkCallOptions, SdkErrorKind } from 'nexdk'
import { isJsonBody, isStreamBody, readBody } from './body.ts'
import { errorsFromData, messageFromData } from './error-data.ts'
import { requestSignal } from './signals.ts'

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

function detail(error: unknown): string {
    const cause = error as Error | undefined
    const text = cause?.message || cause?.toString() || ''
    return text ? ` ${text}` : ''
}

function noResponse(error: unknown, signal: AbortSignal | undefined, method: string | undefined, url: string): HttpError {
    const message = `[${method ?? 'GET'}] ${JSON.stringify(url)}: <no response>${detail(error)}`
    return new HttpError(0, undefined, message, { kind: failureKind(error, signal), cause: error })
}

function unreadable(response: Response, error: unknown, signal: AbortSignal | undefined, method: string | undefined, url: string): HttpError {
    const message = `[${method ?? 'GET'}] ${JSON.stringify(url)}: response body unreadable${detail(error)}`
    return new HttpError(response.status, undefined, message, { kind: failureKind(error, signal), cause: error })
}

export async function request<T>(url: string, init?: HttpRequestInit): Promise<T> {
    const method = init?.method?.toUpperCase()
    const options = requestInit(init, method)
    const { signal, clearTimeout } = requestSignal(init?.signal, init?.timeout)
    if (signal) options.signal = signal
    let response: Response
    try {
        response = await (init?.fetch ?? globalThis.fetch)(url, options)
    } catch (error) {
        throw noResponse(error, signal, method, url)
    } finally {
        clearTimeout()
    }
    if (init?.onResponse) await init.onResponse(response, { url, method: method ?? 'GET' })
    let data: unknown
    try {
        data = await readBody(response, method)
    } catch (error) {
        throw unreadable(response, error, signal, method, url)
    }
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

export function withCallOptions(httpRequest: HttpRequest, options: SdkCallOptions | undefined): HttpRequest {
    if (options === undefined) return httpRequest
    const deadline = callSignal(options)
    return (url, init) =>
        httpRequest(url, {
            ...init,
            headers: options.headers === undefined ? init?.headers : mergeHeaders(init?.headers, options.headers),
            signal: anySignal(init?.signal, deadline),
            timeout: options.timeout ? 0 : init?.timeout,
        })
}
