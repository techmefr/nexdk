import type { AnyResource, PilotaDriver, PilotaEventHandler } from '@pilota/core'
import type { GraphQLOptions, NhostConfig, NhostQueryResult, UpdateByIdPayload, UpsertPayload, UpdateWherePayload, DeleteByIdPayload } from './types.ts'

type SubHandler = (payload: unknown) => void

interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    // pending subscriptions queued before ack
    pending: Array<{ id: string; query: string }>
    // active subscription handlers keyed by id
    handlers: Map<string, SubHandler>
    refCount: number
}

// One shared WS connection per (endpoint + adminSecret) key
const connectionPool = new Map<string, SharedConnection>()

function getSharedConnection(wsUrl: string, adminSecret: string | undefined): SharedConnection {
    const key = `${wsUrl}|${adminSecret ?? ''}`
    const existing = connectionPool.get(key)
    if (existing && existing.ws.readyState !== WebSocket.CLOSED) {
        existing.refCount++
        return existing
    }

    const conn: SharedConnection = {
        ws: new WebSocket(wsUrl, 'graphql-transport-ws'),
        acknowledged: false,
        pending: [],
        handlers: new Map(),
        refCount: 1,
    }

    conn.ws.onopen = () => {
        const initPayload: Record<string, unknown> = {}
        if (adminSecret) initPayload.headers = { 'x-hasura-admin-secret': adminSecret }
        conn.ws.send(JSON.stringify({ type: 'connection_init', payload: initPayload }))
    }

    conn.ws.onmessage = event => {
        const msg = JSON.parse(event.data as string) as { type: string; id?: string; payload?: unknown }

        if (msg.type === 'ping') {
            conn.ws.send(JSON.stringify({ type: 'pong' }))
            return
        }

        if (msg.type === 'connection_ack' && !conn.acknowledged) {
            conn.acknowledged = true
            for (const { id, query } of conn.pending) {
                conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query, variables: {} } }))
            }
            conn.pending = []
            return
        }

        if (msg.type === 'next' && msg.id) {
            conn.handlers.get(msg.id)?.(msg.payload)
        }
    }

    conn.ws.onclose = () => { connectionPool.delete(key) }

    connectionPool.set(key, conn)
    return conn
}

export class NhostDriver implements PilotaDriver {
    readonly name = 'nhost'

    private readonly endpoint: string
    private readonly headers: Record<string, string>
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: NhostConfig) {
        this.endpoint = config.endpoint
        this.headers = {
            'Content-Type': 'application/json',
            ...(config.adminSecret ? { 'x-hasura-admin-secret': config.adminSecret } : {}),
            ...config.headers,
        }
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
    }

    async query<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostQueryResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const operationName = this.buildQueryName(resourceName)
        const document = `query ${operationName} { ${resourceName}${this.buildArgs(payload)} { ${fields} } }`

        try {
            const result = await this.execute<T>(document, {})
            onEvent?.('success', result)
            return result
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Insert a single record — generates Hasura insert_X_one mutation
    async mutation<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<{ data: T | null; errors?: unknown[] }> {
        onEvent?.('request', { resource: resourceName, payload })

        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const data = (payload ?? {}) as Record<string, unknown>

        const document = `mutation { insert_${resourceName}_one(object: ${this.serializeValue(data)}) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, {})
            onEvent?.('success', raw)
            const result = (raw.data as Record<string, T>)?.[`insert_${resourceName}_one`] ?? null
            return { data: result, errors: raw.errors }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Upsert — insert with on_conflict (Hasura-specific)
    async upsert<T>(
        resourceName: string,
        payload: UpsertPayload,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<{ data: T | null; errors?: unknown[] }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { data, conflictConstraint, updateColumns } = payload
        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const cols = updateColumns.join(', ')
        const document = `mutation { insert_${resourceName}_one(object: ${this.serializeValue(data)}, on_conflict: { constraint: ${conflictConstraint}, update_columns: [${cols}] }) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, {})
            onEvent?.('success', raw)
            const result = (raw.data as Record<string, T>)?.[`insert_${resourceName}_one`] ?? null
            return { data: result, errors: raw.errors }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Update by PK
    async updateById<T>(
        resourceName: string,
        payload: UpdateByIdPayload,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<{ data: T | null; errors?: unknown[] }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id, data } = payload
        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const document = `mutation { update_${resourceName}_by_pk(pk_columns: {id: "${id}"}, _set: ${this.serializeValue(data)}) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, {})
            onEvent?.('success', raw)
            const result = (raw.data as Record<string, T>)?.[`update_${resourceName}_by_pk`] ?? null
            return { data: result, errors: raw.errors }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Update many rows matching a where clause
    async updateWhere(
        resourceName: string,
        payload: UpdateWherePayload,
        onEvent?: PilotaEventHandler,
    ): Promise<{ affectedRows: number }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { where, data } = payload
        const document = `mutation { update_${resourceName}(where: ${this.serializeValue(where)}, _set: ${this.serializeValue(data)}) { affected_rows } }`

        try {
            const raw = await this.execute<Record<string, { affected_rows: number }>>(document, {})
            onEvent?.('success', raw)
            const affected = (raw.data as Record<string, { affected_rows: number }>)?.[`update_${resourceName}`]?.affected_rows ?? 0
            return { affectedRows: affected }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Delete by PK
    async deleteById(
        resourceName: string,
        payload: DeleteByIdPayload,
        onEvent?: PilotaEventHandler,
    ): Promise<{ success: boolean }> {
        onEvent?.('request', { resource: resourceName, payload })

        const { id } = payload
        const document = `mutation { delete_${resourceName}_by_pk(id: "${id}") { id } }`

        try {
            await this.execute(document, {})
            onEvent?.('success', { id })
            return { success: true }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            return { success: false }
        }
    }

    subscription(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): () => void {
        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const document = `subscription On${this.singular(resourceName)} { ${resourceName}${this.buildArgs(payload)} { ${fields} } }`

        const wsUrl = this.endpoint.replace(/^http/, 'ws')
        const adminSecret = this.headers['x-hasura-admin-secret']
        const conn = getSharedConnection(wsUrl, adminSecret)

        const id = Math.random().toString(36).slice(2)
        conn.handlers.set(id, payload => onEvent?.('data', payload))

        if (conn.acknowledged) {
            conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query: document, variables: {} } }))
        } else {
            conn.pending.push({ id, query: document })
        }

        return () => {
            conn.handlers.delete(id)
            if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify({ id, type: 'complete' }))
            }
            conn.refCount--
            if (conn.refCount <= 0) {
                conn.ws.close()
            }
        }
    }

    private async execute<T>(
        document: string,
        variables?: Record<string, unknown>,
    ): Promise<NhostQueryResult<T>> {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ query: document, variables }),
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        return (await response.json()) as NhostQueryResult<T>
    }

    private resolveFields(resource: AnyResource | undefined, fragmentKey?: string): string {
        if (resource === undefined) return 'id'

        const key = fragmentKey ?? 'default'
        const fragment = resource.fragments[key]

        if (fragment !== undefined && fragment.length > 0) {
            return fragment.join(' ')
        }

        const shape = (resource.schema as { shape?: Record<string, unknown> }).shape
        if (shape !== undefined) {
            return Object.keys(shape).join(' ')
        }

        return 'id'
    }

    private buildQueryName(resourceName: string): string {
        return `Get${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`
    }

    private singular(resourceName: string): string {
        const name = resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        return name.endsWith('s') ? name.slice(0, -1) : name
    }

    private buildArgs(payload: unknown): string {
        if (!payload || typeof payload !== 'object' || Object.keys(payload as object).length === 0) {
            return ''
        }
        const args = Object.entries(payload as Record<string, unknown>)
            .map(([key, value]) => `${key}: ${this.serializeValue(value)}`)
            .join(', ')
        return args ? `(${args})` : ''
    }

    private serializeValue(value: unknown): string {
        if (value === null) return 'null'
        if (typeof value === 'string') return `"${value}"`
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        if (Array.isArray(value)) return `[${value.map(v => this.serializeValue(v)).join(', ')}]`
        if (typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>)
                .map(([k, v]) => `${k}: ${this.serializeValue(v)}`)
                .join(', ')
            return `{${entries}}`
        }
        return String(value)
    }
}
