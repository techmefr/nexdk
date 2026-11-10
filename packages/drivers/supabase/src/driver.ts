import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { SdkError, toErrorPayload, traceCall } from 'nexdk'
import type { AnyResource, ErrorEventPayload, SdkCallOptions, SdkDriver, SdkErrorKind, SdkEventHandler } from 'nexdk'
import { applyCallOptions } from './call-options.ts'
import type { QueryBuilder } from './call-options.ts'
import type { SupabaseConfig, SupabaseError, SupabaseResourceApi, SupabaseResult } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        supabase: SupabaseResourceApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        supabase: SupabaseResourceApi<T, true>
    }
}

export class SupabaseQueryError extends SdkError {
    readonly code: string | undefined
    readonly details: string | null | undefined
    readonly hint: string | null | undefined

    constructor(error: SupabaseError, status?: number, kind?: SdkErrorKind) {
        super(error.message, {
            status,
            errors: { code: error.code, details: error.details, hint: error.hint },
            data: error,
            kind,
        })
        this.name = 'SupabaseQueryError'
        this.code = error.code
        this.details = error.details
        this.hint = error.hint
    }
}

function describeError(error: unknown): ErrorEventPayload {
    const payload = toErrorPayload(error)
    return error instanceof SupabaseQueryError ? { ...(error.data as SupabaseError), ...payload } : payload
}

export class SupabaseDriver implements SdkDriver {
    readonly name = 'supabase'
    readonly reactiveMethods = ['subscribe'] as const

    declare readonly __apiUri: 'supabase'

    private readonly client: SupabaseClient
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: SupabaseConfig) {
        this.client = createClient(
            config.url,
            config.key,
            config.fetch ? { global: { fetch: config.fetch as typeof fetch } } : undefined,
        )
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
    }

    private call<R>(
        method: string,
        target: { resourceName: string; payload: unknown; onEvent: SdkEventHandler | undefined },
        run: () => Promise<R>,
    ): Promise<R> {
        const { resourceName, payload, onEvent } = target
        return traceCall({ emit: onEvent, resource: resourceName, method, payload, describeError }, run)
    }

    private async execute<R>(query: QueryBuilder, options: SdkCallOptions | undefined): Promise<R> {
        const { builder, errorKind } = applyCallOptions(query, options)
        const { data, error, status } = await builder
        if (error !== null) throw new SupabaseQueryError(error, status, errorKind(status))
        return data as R
    }

    private requireId(method: string, payload: unknown): Record<string, unknown> {
        if (payload !== null && typeof payload === 'object') return payload as Record<string, unknown>
        throw new SdkError(`${method} requires a payload with an id`)
    }

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SupabaseResult<T>> {
        return this.call('get', { resourceName, payload, onEvent }, async () => {
            const query = this.client.from(resourceName).select('*')

            if (payload && typeof payload === 'object') {
                for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
                    if (value === null) query.is(key, null)
                    else query.eq(key, value)
                }
            }

            return { data: await this.execute<T[]>(query, options) }
        })
    }

    async insert<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SupabaseResult<T>> {
        return this.call('insert', { resourceName, payload, onEvent }, async () => {
            const query = this.client
                .from(resourceName)
                .insert(payload as Record<string, unknown>)
                .select()
            return { data: await this.execute<T[]>(query, options) }
        })
    }

    async update<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<SupabaseResult<T>> {
        return this.call('update', { resourceName, payload, onEvent }, async () => {
            const { id, ...rest } = this.requireId('update', payload)

            const query = this.client
                .from(resourceName)
                .update(rest)
                .eq('id', id)
                .select()
            return { data: await this.execute<T[]>(query, options) }
        })
    }

    async remove(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<{ success: boolean }> {
        return this.call('remove', { resourceName, payload, onEvent }, async () => {
            const { id } = this.requireId('remove', payload)
            await this.execute(this.client.from(resourceName).delete().eq('id', id), options)
            return { success: true }
        })
    }

    subscribe(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): () => void {
        const roomId =
            payload && typeof payload === 'object' && 'room_id' in (payload as object)
                ? String((payload as Record<string, unknown>)['room_id'])
                : undefined
        if (roomId !== undefined && !/^[\w-]+$/.test(roomId)) throw new Error('Invalid room_id')
        const filter = roomId === undefined ? undefined : `room_id=eq.${roomId}`

        const channel: RealtimeChannel = this.client
            .channel(`${resourceName}-${Math.random().toString(36).slice(2)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: resourceName,
                    ...(filter ? { filter } : {}),
                },
                payload => {
                    onEvent?.('data', payload)
                },
            )
            .subscribe(status => {
                if (status === 'SUBSCRIBED') onEvent?.('connected', { resource: resourceName })
                if (status === 'CLOSED') onEvent?.('disconnected', { resource: resourceName })
            })

        return () => {
            this.client.removeChannel(channel)
        }
    }
}
