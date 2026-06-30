import type { PilotaEventHandler } from 'beepr'
import type { AnyResource, PilotaDriver } from 'nexdk'
import type { GraphQLOptions, NhostConfig, NhostQueryResult, NhostResourceApi, UpdateByIdPayload, UpsertPayload, UpdateWherePayload, DeleteByIdPayload } from './types.ts'

// Register the nhost per-resource API in core's registry so the typed SDK can
// resolve `sdk.nhost.<resource>` to NhostResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nhost: NhostResourceApi<T>
    }
}

type SubHandler = (payload: unknown) => void

interface SharedConnection {
    ws: WebSocket
    acknowledged: boolean
    // pending subscriptions queued before ack
    pending: Array<{ id: string; query: string; variables: Record<string, unknown> }>
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
            for (const { id, query, variables } of conn.pending) {
                conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query, variables } }))
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

// GraphQL type for a top-level argument of a list query / subscription.
// We map well-known Hasura argument names to their generated input types so
// user-supplied values travel as variables instead of being interpolated.
function argType(resourceName: string, argName: string): string {
    switch (argName) {
        case 'where': return `${resourceName}_bool_exp`
        case 'order_by': return `[${resourceName}_order_by!]`
        case 'limit':
        case 'offset': return 'Int'
        case 'distinct_on': return `[${resourceName}_select_column!]`
        default: return 'jsonb'
    }
}

export class NhostDriver implements PilotaDriver {
    readonly name = 'nhost'

    // Phantom marker: the SDK reads this uri to look up NhostResourceApi<T> in
    // the augmented ResourceApiKinds registry. Never used at runtime.
    declare readonly __apiUri: 'nhost'

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
        const { decls, args, variables } = this.buildVarArgs(resourceName, payload)
        const document = `query ${operationName}${decls} { ${resourceName}${args} { ${fields} } }`

        try {
            const result = await this.execute<T>(document, variables)
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

        const document = `mutation Insert${this.singular(resourceName)}($object: ${resourceName}_insert_input!) { insert_${resourceName}_one(object: $object) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, { object: data })
            onEvent?.('success', raw)
            const result = (raw.data as Record<string, T>)?.[`insert_${resourceName}_one`] ?? null
            return { data: result, errors: raw.errors }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    // Upsert — insert with on_conflict (Hasura-specific).
    // `object` carries user data and travels as a variable. `conflictConstraint`
    // and `updateColumns` are GraphQL enum / enum-array identifiers coming from
    // developer code (defineResource / call site), never end-user input, so they
    // are kept inline — Hasura's on_conflict enums cannot be passed as variables
    // in older versions. They are validated to contain only enum-safe characters.
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
        const constraint = enumIdentifier(conflictConstraint)
        const cols = updateColumns.map(enumIdentifier).join(', ')
        const document = `mutation Upsert${this.singular(resourceName)}($object: ${resourceName}_insert_input!) { insert_${resourceName}_one(object: $object, on_conflict: { constraint: ${constraint}, update_columns: [${cols}] }) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, { object: data })
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
        const document = `mutation Update${this.singular(resourceName)}($pk: ${resourceName}_pk_columns_input!, $set: ${resourceName}_set_input!) { update_${resourceName}_by_pk(pk_columns: $pk, _set: $set) { ${fields} } }`

        try {
            const raw = await this.execute<Record<string, T>>(document, { pk: { id }, set: data })
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
        const document = `mutation UpdateWhere${this.singular(resourceName)}($where: ${resourceName}_bool_exp!, $set: ${resourceName}_set_input!) { update_${resourceName}(where: $where, _set: $set) { affected_rows } }`

        try {
            const raw = await this.execute<Record<string, { affected_rows: number }>>(document, { where, set: data })
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
        const document = `mutation Delete${this.singular(resourceName)}($id: uuid!) { delete_${resourceName}_by_pk(id: $id) { id } }`

        try {
            await this.execute(document, { id })
            onEvent?.('success', { id })
            return { success: true }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
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
        const { decls, args, variables } = this.buildVarArgs(resourceName, payload)
        const document = `subscription On${this.singular(resourceName)}${decls} { ${resourceName}${args} { ${fields} } }`

        const wsUrl = this.endpoint.replace(/^http/, 'ws')
        const adminSecret = this.headers['x-hasura-admin-secret']
        const conn = getSharedConnection(wsUrl, adminSecret)

        const id = Math.random().toString(36).slice(2)
        conn.handlers.set(id, payload => onEvent?.('data', payload))

        if (conn.acknowledged) {
            conn.ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query: document, variables } }))
        } else {
            conn.pending.push({ id, query: document, variables })
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

    // Build typed variable declarations and the matching argument list for a
    // list query / subscription. Each top-level argument value becomes a GraphQL
    // variable so no user-supplied scalar is ever interpolated into the document.
    private buildVarArgs(resourceName: string, payload: unknown): { decls: string; args: string; variables: Record<string, unknown> } {
        if (!payload || typeof payload !== 'object' || Object.keys(payload as object).length === 0) {
            return { decls: '', args: '', variables: {} }
        }
        const decls: string[] = []
        const args: string[] = []
        const variables: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
            decls.push(`$${key}: ${argType(resourceName, key)}`)
            args.push(`${key}: $${key}`)
            variables[key] = value
        }
        return { decls: `(${decls.join(', ')})`, args: `(${args.join(', ')})`, variables }
    }
}

// Validate a developer-controlled GraphQL enum identifier (constraint name,
// column name). Enums are emitted inline, so reject anything that is not a bare
// GraphQL name to prevent injection through misconfigured developer code.
function enumIdentifier(name: string): string {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name)) {
        throw new Error(`Invalid GraphQL enum identifier: ${name}`)
    }
    return name
}
