import { defineDriver, resolveHeaders } from 'nexdk'
import type { AnyResource, SdkEventHandler } from 'nexdk'
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

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        nhost: NhostResourceApi<T>
    }
}

function asOptions(value: unknown): GraphQLOptions | undefined {
    return value as GraphQLOptions | undefined
}

function assertNoGraphQLErrors(raw: NhostQueryResult<unknown>): void {
    if (raw.errors && raw.errors.length > 0) {
        throw new Error(raw.errors.map(error => error.message).join('; '))
    }
}

function subscriptionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface NhostState {
    endpoint: string
    adminSecret: string | undefined
    resolveInitHeaders: () => Promise<Record<string, string>>
    execute: <T>(document: string, variables?: Record<string, unknown>) => Promise<NhostQueryResult<T>>
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function toWebSocketUrl(endpoint: string): string {
    const url = new URL(endpoint)
    if (url.protocol === 'https:') {
        url.protocol = 'wss:'
    } else if (url.protocol === 'http:') {
        if (!LOCAL_HOSTS.has(url.hostname)) {
            throw new Error(`Refusing an unencrypted WebSocket to ${url.hostname}: use an https endpoint`)
        }
        url.protocol = 'ws:'
    } else {
        throw new Error(`Unsupported endpoint protocol: ${url.protocol}`)
    }
    return url.toString()
}

const defineNhostDriver = defineDriver<NhostConfig, NhostState, {
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
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const operationName = buildQueryName(ctx.resourceName)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `query ${operationName}${decls} { ${ctx.resourceName}${args} { ${fields} } }`
            const raw = await ctx.execute(document, variables)
            assertNoGraphQLErrors(raw)
            return raw
        },
        mutation: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const data = (payload ?? {}) as Record<string, unknown>
            const document = `mutation Insert${singular(ctx.resourceName)}($object: ${ctx.resourceName}_insert_input!) { insert_${ctx.resourceName}_one(object: $object) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data })
            assertNoGraphQLErrors(raw)
            const result = (raw.data as Record<string, unknown>)?.[`insert_${ctx.resourceName}_one`] ?? null
            return { data: result }
        },
        upsert: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const { data, conflictConstraint, updateColumns } = payload as UpsertPayload
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const constraint = enumIdentifier(conflictConstraint)
            const cols = updateColumns.map(enumIdentifier).join(', ')
            const document = `mutation Upsert${singular(ctx.resourceName)}($object: ${ctx.resourceName}_insert_input!) { insert_${ctx.resourceName}_one(object: $object, on_conflict: { constraint: ${constraint}, update_columns: [${cols}] }) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data })
            assertNoGraphQLErrors(raw)
            const result = (raw.data as Record<string, unknown>)?.[`insert_${ctx.resourceName}_one`] ?? null
            return { data: result }
        },
        updateById: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const { id, data } = payload as UpdateByIdPayload
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const document = `mutation Update${singular(ctx.resourceName)}($pk: ${ctx.resourceName}_pk_columns_input!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}_by_pk(pk_columns: $pk, _set: $set) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { pk: { id }, set: data })
            assertNoGraphQLErrors(raw)
            const result = (raw.data as Record<string, unknown>)?.[`update_${ctx.resourceName}_by_pk`] ?? null
            return { data: result }
        },
        updateWhere: async (ctx, payload) => {
            enumIdentifier(ctx.resourceName)
            const { where, data } = payload as UpdateWherePayload
            const document = `mutation UpdateWhere${singular(ctx.resourceName)}($where: ${ctx.resourceName}_bool_exp!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}(where: $where, _set: $set) { affected_rows } }`
            const raw = await ctx.execute<Record<string, { affected_rows: number }>>(document, { where, set: data })
            assertNoGraphQLErrors(raw)
            const affected = (raw.data as Record<string, { affected_rows: number }>)?.[`update_${ctx.resourceName}`]?.affected_rows ?? 0
            return { affectedRows: affected }
        },
        deleteById: async (ctx, payload) => {
            enumIdentifier(ctx.resourceName)
            const { id } = payload as DeleteByIdPayload
            const document = `mutation Delete${singular(ctx.resourceName)}($id: uuid!) { delete_${ctx.resourceName}_by_pk(id: $id) { id } }`
            const raw = await ctx.execute(document, { id })
            assertNoGraphQLErrors(raw)
            return { success: true }
        },
        subscription: (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `subscription On${singular(ctx.resourceName)}${decls} { ${ctx.resourceName}${args} { ${fields} } }`

            const wsUrl = toWebSocketUrl(ctx.endpoint)
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
                    conn.intentionalClose = true
                    conn.ws.close()
                }
            }
        },
    },
})

type CtxBase = { resourceName: string; resource: AnyResource | undefined; emit: SdkEventHandler | undefined }

export function nhostDriver(config: NhostConfig): ReturnType<typeof defineNhostDriver> {
    const driver = defineNhostDriver(config)
    const bindResource = driver.bindResource.bind(driver)
    driver.bindResource = (resourceName, resource) => {
        enumIdentifier(resourceName)
        bindResource(resourceName, resource)
    }
    return driver
}
