import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { SdkError, toErrorPayload } from 'nexdk'
import type { AnyResource, SdkDriver, SdkEventHandler } from 'nexdk'
import type { SupabaseConfig, SupabaseError, SupabaseResourceApi, SupabaseResult } from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        supabase: SupabaseResourceApi<T>
    }
}

export class SupabaseQueryError extends SdkError {
    readonly code: string | undefined
    readonly details: string | null | undefined
    readonly hint: string | null | undefined

    constructor(error: SupabaseError, status?: number) {
        super(error.message, {
            status,
            errors: { code: error.code, details: error.details, hint: error.hint },
            data: error,
        })
        this.name = 'SupabaseQueryError'
        this.code = error.code
        this.details = error.details
        this.hint = error.hint
    }
}

export class SupabaseDriver implements SdkDriver {
    readonly name = 'supabase'

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

    private fail(error: SupabaseError, status: number | undefined, onEvent?: SdkEventHandler): never {
        const queryError = new SupabaseQueryError(error, status)
        onEvent?.('error', { ...error, ...toErrorPayload(queryError) })
        throw queryError
    }

    private requireId(
        method: string,
        payload: unknown,
        onEvent?: SdkEventHandler,
    ): Record<string, unknown> {
        if (payload !== null && typeof payload === 'object') return payload as Record<string, unknown>
        const error = new SdkError(`${method} requires a payload with an id`)
        onEvent?.('error', toErrorPayload(error))
        throw error
    }

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const query = this.client.from(resourceName).select('*')

        if (payload && typeof payload === 'object') {
            for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
                if (value === null) query.is(key, null)
                else query.eq(key, value)
            }
        }

        const { data, error, status } = await query

        if (error !== null) this.fail(error, status, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async insert<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { data, error, status } = await this.client
            .from(resourceName)
            .insert(payload as Record<string, unknown>)
            .select()

        if (error !== null) this.fail(error, status, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async update<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id, ...rest } = this.requireId('update', payload, onEvent)

        const { data, error, status } = await this.client
            .from(resourceName)
            .update(rest)
            .eq('id', id)
            .select()

        if (error !== null) this.fail(error, status, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async remove(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<{ success: boolean }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id } = this.requireId('remove', payload, onEvent)

        const { error, status } = await this.client.from(resourceName).delete().eq('id', id)

        if (error !== null) this.fail(error, status, onEvent)

        onEvent?.('success', { deleted: true })
        return { success: true }
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
