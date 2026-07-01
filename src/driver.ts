import { defineDriver, resolveHeaders } from 'nexdk'
import type { AnyResource, PilotaEventHandler } from 'nexdk'
import type {
    DeleteByIdPayload,
    GraphQLOptions,
    NhostConfig,
    NhostQueryResult,
    NhostResourceApi,
    UpdateByIdPayload,
    UpdateWherePayload,
    UpsertPayload,
} from './types.ts'
import { getSharedConnection } from './connection-pool.ts'
import {
    buildQueryName,
    buildVarArgs,
    enumIdentifier,
    resolveFields,
    singular,
} from './document.ts'

// Register the nhost per-resource API in core's registry so the typed SDK can
// resolve `sdk.nhost.<resource>` to NhostResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nhost: NhostResourceApi<T>
    }
}

// Narrow the third call argument (forwarded in the mock slot) to GraphQL options.
function asOptions(value: unknown): GraphQLOptions | undefined {
    return value as GraphQLOptions | undefined
}

// Generate a subscription id. Prefer the standard crypto UUID, with a tiny
// fallback for the rare runtime that lacks it.
function subscriptionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// State built once from the config and spread into every method's ctx: the
// endpoint, the admin secret, the (per-request) header builder, the raw headers
// resolver reused on every WS (re)connect, and the GraphQL POST executor.
interface NhostState {
    endpoint: string
    adminSecret: string | undefined
    resolveInitHeaders: () => Promise<Record<string, string>>
    execute: <T>(document: string, variables?: Record<string, unknown>) => Promise<NhostQueryResult<T>>
}

// Conventional Hasura/Nhost GraphQL driver. Built with defineDriver: each method
// carries only the document building + result shaping; the request/success/error
// events are supplied by the helper. `subscription` returns a teardown function,
// so the helper treats it as reactive and returns it untouched.
// The SDK grammar is `sdk.nhost.<resource>.<method>(payload, onEvent, options)`.
// createPilota forwards that third call argument in the driver's `mock` slot, so
// nhost has no mock concept: its third method parameter carries the GraphQL
// options (fragment selection).
export const nhostDriver = defineDriver<NhostConfig, NhostState, {
    query: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<unknown>
    mutation: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<unknown>
    upsert: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<unknown>
    updateById: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<unknown>
    updateWhere: (ctx: NhostState & CtxBase, payload: unknown) => Promise<{ affectedRows: number }>
    deleteById: (ctx: NhostState & CtxBase, payload: unknown) => Promise<{ success: boolean }>
    subscription: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => () => void
}>({
    name: 'nhost',
    setup: config => {
        const buildHeaders = async (): Promise<Record<string, string>> => ({
            'Content-Type': 'application/json',
            ...(config.adminSecret ? { 'x-hasura-admin-secret': config.adminSecret } : {}),
            ...(await resolveHeaders(config.headers)),
        })
        return {
            endpoint: config.endpoint,
            adminSecret: config.adminSecret,
            resolveInitHeaders: () => resolveHeaders(config.headers),
            execute: async <T>(document: string, variables?: Record<string, unknown>) => {
                const response = await fetch(config.endpoint, {
                    method: 'POST',
                    headers: await buildHeaders(),
                    body: JSON.stringify({ query: document, variables }),
                })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return (await response.json()) as NhostQueryResult<T>
            },
        }
    },
    methods: {
        query: async (ctx, payload, options) => {
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const operationName = buildQueryName(ctx.resourceName)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `query ${operationName}${decls} { ${ctx.resourceName}${args} { ${fields} } }`
            return ctx.execute(document, variables)
        },
        // Insert a single record — generates Hasura insert_X_one mutation.
        mutation: async (ctx, payload, options) => {
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const data = (payload ?? {}) as Record<string, unknown>
            const document = `mutation Insert${singular(ctx.resourceName)}($object: ${ctx.resourceName}_insert_input!) { insert_${ctx.resourceName}_one(object: $object) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data })
            const result = (raw.data as Record<string, unknown>)?.[`insert_${ctx.resourceName}_one`] ?? null
            return { data: result, errors: raw.errors }
        },
        // Upsert — insert with on_conflict (Hasura-specific). `object` carries user
        // data and travels as a variable. `conflictConstraint` and `updateColumns`
        // are GraphQL enum identifiers from developer code, never end-user input,
        // so they are kept inline (older Hasura cannot pass on_conflict enums as
        // variables) after being validated as enum-safe identifiers.
        upsert: async (ctx, payload, options) => {
            const { data, conflictConstraint, updateColumns } = payload as UpsertPayload
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const constraint = enumIdentifier(conflictConstraint)
            const cols = updateColumns.map(enumIdentifier).join(', ')
            const document = `mutation Upsert${singular(ctx.resourceName)}($object: ${ctx.resourceName}_insert_input!) { insert_${ctx.resourceName}_one(object: $object, on_conflict: { constraint: ${constraint}, update_columns: [${cols}] }) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data })
            const result = (raw.data as Record<string, unknown>)?.[`insert_${ctx.resourceName}_one`] ?? null
            return { data: result, errors: raw.errors }
        },
        // Update by PK.
        updateById: async (ctx, payload, options) => {
            const { id, data } = payload as UpdateByIdPayload
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const document = `mutation Update${singular(ctx.resourceName)}($pk: ${ctx.resourceName}_pk_columns_input!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}_by_pk(pk_columns: $pk, _set: $set) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { pk: { id }, set: data })
            const result = (raw.data as Record<string, unknown>)?.[`update_${ctx.resourceName}_by_pk`] ?? null
            return { data: result, errors: raw.errors }
        },
        // Update many rows matching a where clause.
        updateWhere: async (ctx, payload) => {
            const { where, data } = payload as UpdateWherePayload
            const document = `mutation UpdateWhere${singular(ctx.resourceName)}($where: ${ctx.resourceName}_bool_exp!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}(where: $where, _set: $set) { affected_rows } }`
            const raw = await ctx.execute<Record<string, { affected_rows: number }>>(document, { where, set: data })
            const affected = (raw.data as Record<string, { affected_rows: number }>)?.[`update_${ctx.resourceName}`]?.affected_rows ?? 0
            return { affectedRows: affected }
        },
        // Delete by PK.
        deleteById: async (ctx, payload) => {
            const { id } = payload as DeleteByIdPayload
            const document = `mutation Delete${singular(ctx.resourceName)}($id: uuid!) { delete_${ctx.resourceName}_by_pk(id: $id) { id } }`
            await ctx.execute(document, { id })
            return { success: true }
        },
        subscription: (ctx, payload, options) => {
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `subscription On${singular(ctx.resourceName)}${decls} { ${ctx.resourceName}${args} { ${fields} } }`

            const wsUrl = ctx.endpoint.replace(/^http/, 'ws')
            // The pool merges the admin secret; the resolver supplies dynamic
            // headers (e.g. a bearer token) into connection_init on every reconnect.
            const conn = getSharedConnection(wsUrl, ctx.adminSecret, ctx.resolveInitHeaders)

            const id = subscriptionId()
            conn.handlers.set(id, {
                handler: data => ctx.emit?.('data', data),
                query: document,
                variables,
            })

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
                    // Mark the teardown as intentional so onclose does not reconnect.
                    conn.intentionalClose = true
                    conn.ws.close()
                }
            }
        },
    },
})

// Base ctx fields every method receives from defineDriver.
type CtxBase = { resourceName: string; resource: AnyResource | undefined; emit: PilotaEventHandler | undefined }
