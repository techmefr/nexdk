import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { AnyResource, SdkDriver, SdkEventHandler } from 'nexdk'
import type { SupabaseConfig, SupabaseError, SupabaseResourceApi, SupabaseResult } from './types.ts'

// Register the supabase per-resource API in core's registry so the typed SDK
// can resolve `sdk.supabase.<resource>` to SupabaseResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        supabase: SupabaseResourceApi<T>
    }
}

// Thrown after a Postgrest error has been emitted, carrying its code/details/hint.
export class SupabaseQueryError extends Error {
    readonly code: string | undefined
    readonly details: string | undefined
    readonly hint: string | undefined

    constructor(error: SupabaseError) {
        super(error.message)
        this.name = 'SupabaseQueryError'
        this.code = error.code
        this.details = error.details
        this.hint = error.hint
    }
}

export class SupabaseDriver implements SdkDriver {
    readonly name = 'supabase'

    // Phantom marker: the SDK reads this uri to look up SupabaseResourceApi<T>
    // in the augmented ResourceApiKinds registry. Never used at runtime.
    declare readonly __apiUri: 'supabase'

    private readonly client: SupabaseClient
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: SupabaseConfig) {
        this.client = createClient(config.url, config.key)
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
    }

    // Emit the typed 'error' event with the full Postgrest detail and throw,
    // matching the unified driver contract (emit 'error' then throw).
    private fail(error: SupabaseError, onEvent?: SdkEventHandler): never {
        onEvent?.('error', error)
        throw new SupabaseQueryError(error)
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
                query.eq(key, value)
            }
        }

        const { data, error } = await query

        if (error !== null) this.fail(error, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async insert<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { data, error } = await this.client
            .from(resourceName)
            .insert(payload as Record<string, unknown>)
            .select()

        if (error !== null) this.fail(error, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async update<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id, ...rest } = payload as Record<string, unknown>

        const { data, error } = await this.client
            .from(resourceName)
            .update(rest)
            .eq('id', id)
            .select()

        if (error !== null) this.fail(error, onEvent)

        onEvent?.('success', { data })
        return { data: data as T[] }
    }

    async remove(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<{ success: boolean }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id } = payload as Record<string, unknown>

        const { error } = await this.client.from(resourceName).delete().eq('id', id)

        if (error !== null) this.fail(error, onEvent)

        onEvent?.('success', { deleted: true })
        return { success: true }
    }

    subscribe(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): () => void {
        const filter =
            payload && typeof payload === 'object' && 'room_id' in (payload as object)
                ? `room_id=eq.${(payload as Record<string, unknown>)['room_id']}`
                : undefined

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
