import { SdkError, resolveHeaders } from 'nexdk'
import type { SdkCallOptions } from 'nexdk'
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
    return async <T>(document: string, variables?: Record<string, unknown>, options?: SdkCallOptions) => {
        const signal = callSignal(options)
        const response = await (config.fetch ?? fetch)(config.endpoint, {
            method: 'POST',
            headers: callHeaders(await buildHeaders(), options?.headers),
            body: JSON.stringify({ query: document, variables }),
            ...(signal === undefined ? {} : { signal }),
        })
        if (!response.ok) throw await toHttpError(response)
        return (await response.json()) as NhostQueryResult<T>
    }
}

export function assertNoGraphQLErrors(raw: NhostQueryResult<unknown>): void {
    if (raw.errors && raw.errors.length > 0) {
        throw new SdkError(raw.errors.map(error => error.message).join('; '), { errors: raw.errors, data: raw })
    }
}

async function toHttpError(response: Response): Promise<SdkError> {
    let data: unknown
    try {
        data = await response.json()
    } catch {
        data = undefined
    }
    const body = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
    const errors = body?.errors
    return new SdkError(`HTTP ${response.status}`, { status: response.status, errors, data })
}
