import { callSignal, failureKind } from 'nexdk'
import type { SdkCallOptions, SdkErrorKind } from 'nexdk'
import type { SupabaseError } from './types.ts'

interface CallableBuilder {
    abortSignal(signal: AbortSignal): unknown
    setHeader(name: string, value: string): unknown
}

export type QueryBuilder = CallableBuilder & PromiseLike<{ data: unknown; error: SupabaseError | null; status: number }>

export interface AppliedCall<B> {
    builder: B
    errorKind: (status: number | undefined) => SdkErrorKind | undefined
}

export function applyCallOptions<B extends CallableBuilder>(builder: B, options: SdkCallOptions | undefined): AppliedCall<B> {
    const signal = callSignal(options)
    if (signal !== undefined) builder.abortSignal(signal)
    for (const [name, value] of Object.entries(options?.headers ?? {})) builder.setHeader(name, value)
    const errorKind = (status: number | undefined): SdkErrorKind | undefined => {
        if (signal?.aborted) return failureKind(undefined, signal)
        if (status === 0) return 'network'
        return status !== undefined && status >= 400 ? 'http' : undefined
    }
    return { builder, errorKind }
}
