import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { AnyResource, PilotaDriver, PilotaEventHandler } from '@pilota/core'
import type { SupabaseConfig, SupabaseResourceApi, SupabaseResult } from './types.ts'

// Register the supabase per-resource API in core's registry so the typed SDK
// can resolve `sdk.supabase.<resource>` to SupabaseResourceApi<T>.
declare module '@pilota/core' {
    interface ResourceApiKinds<T> {
        supabase: SupabaseResourceApi<T>
    }
}

export class SupabaseDriver implements PilotaDriver {
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

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const query = this.client.from(resourceName).select('*')

        if (payload && typeof payload === 'object') {
            for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
                query.eq(key, value)
            }
        }

        const { data, error } = await query

        if (error !== null) {
            onEvent?.('error', error)
            return { data: null, error }
        }

        onEvent?.('success', { data })
        return { data: data as T[], error: null }
    }

    async insert<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { data, error } = await this.client
            .from(resourceName)
            .insert(payload as Record<string, unknown>)
            .select()

        if (error !== null) {
            onEvent?.('error', error)
            return { data: null, error }
        }

        onEvent?.('success', { data })
        return { data: data as T[], error: null }
    }

    async update<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
    ): Promise<SupabaseResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id, ...rest } = payload as Record<string, unknown>

        const { data, error } = await this.client
            .from(resourceName)
            .update(rest)
            .eq('id', id)
            .select()

        if (error !== null) {
            onEvent?.('error', error)
            return { data: null, error }
        }

        onEvent?.('success', { data })
        return { data: data as T[], error: null }
    }

    async remove(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
    ): Promise<SupabaseResult<never>> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id } = payload as Record<string, unknown>

        const { error } = await this.client.from(resourceName).delete().eq('id', id)

        if (error !== null) {
            onEvent?.('error', error)
            return { data: null, error }
        }

        onEvent?.('success', { deleted: true })
        return { data: null, error: null }
    }

    subscribe(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
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
