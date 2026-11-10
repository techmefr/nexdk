import { resolveHeaders } from 'nexdk'
import type { SdkCallOptions } from 'nexdk'
import { failureError, graphQLError, toHttpError } from './errors.ts'
import type { NhostConfig, NhostQueryResult } from './types.ts'

export type Execute = <T>(
    document: string,
    variables?: Record<string, unknown>,
    options?: SdkCallOptions,
) => Promise<NhostQueryResult<T>>

function callSignal(options: SdkCallOptions | undefined): AbortSignal | undefined {
    const timeout = options?.timeout ? AbortSignal.timeout(options.timeout) : undefined
    if (options?.signal === undefined || timeout === undefined) return options?.signal ?? timeout
    return AbortSignal.any([options.signal, timeout])
}

function callHeaders(base: Record<string, string>, extra: Record<string, string> | undefined): Record<string, string> {
    if (extra === undefined) return base
    const headers = new Headers(base)
    for (const [name, value] of Object.entries(extra)) headers.set(name, value)
    return Object.fromEntries(headers)
}

export function createExecute(config: NhostConfig): Execute {
    const buildHeaders = async (): Promise<Record<string, string>> => ({
        'Content-Type': 'application/json',
        ...(config.adminSecret ? { 'x-hasura-admin-secret': config.adminSecret } : {}),
        ...(await resolveHeaders(config.headers)),
    })
    const post = async (init: RequestInit, signal: AbortSignal | undefined): Promise<Response> => {
        try {
            return await (config.fetch ?? fetch)(config.endpoint, init)
        } catch (error) {
            throw failureError(error, signal)
        }
    }
    return async <T>(document: string, variables?: Record<string, unknown>, options?: SdkCallOptions) => {
        const signal = callSignal(options)
        const response = await post({
            method: 'POST',
            headers: callHeaders(await buildHeaders(), options?.headers),
            body: JSON.stringify({ query: document, variables }),
            ...(signal === undefined ? {} : { signal }),
        }, signal)
        if (config.onResponse) await config.onResponse(response, { url: config.endpoint, method: 'POST' })
        if (!response.ok) throw await toHttpError(response)
        return (await response.json()) as NhostQueryResult<T>
    }
}

export function assertNoGraphQLErrors(raw: NhostQueryResult<unknown>): void {
    if (raw.errors && raw.errors.length > 0) throw graphQLError(raw.errors, raw)
}
