import { anySignal, callSignal, mergeHeaders, resolveHeaders } from 'nexdk'
import type { SdkCallOptions } from 'nexdk'
import { failureError, graphQLError, toHttpError, unreadableError } from './errors.ts'
import type { NhostConfig, NhostQueryResult } from './types.ts'

export type Execute = <T>(
    document: string,
    variables?: Record<string, unknown>,
    options?: SdkCallOptions,
) => Promise<NhostQueryResult<T>>

function executeSignal(config: NhostConfig, options: SdkCallOptions | undefined): AbortSignal | undefined {
    const timeout = options?.timeout ?? config.timeout
    return anySignal(config.signal, callSignal({ signal: options?.signal, timeout }))
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
    const read = async <T>(response: Response, signal: AbortSignal | undefined): Promise<NhostQueryResult<T>> => {
        try {
            return (await response.json()) as NhostQueryResult<T>
        } catch (error) {
            throw unreadableError(response, error, signal)
        }
    }
    return async <T>(document: string, variables?: Record<string, unknown>, options?: SdkCallOptions) => {
        const signal = executeSignal(config, options)
        const response = await post({
            method: 'POST',
            headers: mergeHeaders(await buildHeaders(), options?.headers),
            body: JSON.stringify({ query: document, variables }),
            ...(signal === undefined ? {} : { signal }),
        }, signal)
        if (config.onResponse) await config.onResponse(response, { url: config.endpoint, method: 'POST' })
        if (!response.ok) throw await toHttpError(response)
        return read<T>(response, signal)
    }
}

export function assertNoGraphQLErrors(raw: NhostQueryResult<unknown>): void {
    if (raw.errors && raw.errors.length > 0) throw graphQLError(raw.errors, raw)
}
