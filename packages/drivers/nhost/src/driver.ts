import { defineDriver } from 'nexdk'
import type { AnyResource, SdkEventHandler } from 'nexdk'
import type {
    DeleteByIdPayload,
    GraphQLOptions,
    HeadersResolver,
    NhostConfig,
    NhostResourceApi,
    UpdateByIdPayload,
    UpdateWherePayload,
    UpsertPayload,
} from './types.ts'
import { addSubscription, getSharedConnection, removeSubscription } from './connection-pool.ts'
import { assertNoGraphQLErrors, createExecute } from './graphql-http.ts'
import type { Execute } from './graphql-http.ts'
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
    interface ThrowingResourceApiKinds<T> {
        nhost: NhostResourceApi<T, true>
    }
}

function asOptions(value: unknown): GraphQLOptions | undefined {
    return value as GraphQLOptions | undefined
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
    headers: HeadersResolver | undefined
    poolOwner: object
    execute: Execute
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
    updateWhere: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<{ affectedRows: number }>
    deleteById: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => Promise<{ success: boolean }>
    subscription: (ctx: NhostState & CtxBase, payload: unknown, options: unknown) => () => void
}>({
    name: 'nhost',
    setup: config => ({
        endpoint: config.endpoint,
        adminSecret: config.adminSecret,
        headers: config.headers,
        poolOwner: {},
        execute: createExecute(config),
    }),
    methods: {
        query: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const operationName = buildQueryName(ctx.resourceName)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `query ${operationName}${decls} { ${ctx.resourceName}${args} { ${fields} } }`
            const raw = await ctx.execute(document, variables, asOptions(options))
            assertNoGraphQLErrors(raw)
            return raw
        },
        mutation: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const data = (payload ?? {}) as Record<string, unknown>
            const document = `mutation Insert${singular(ctx.resourceName)}($object: ${ctx.resourceName}_insert_input!) { insert_${ctx.resourceName}_one(object: $object) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data }, asOptions(options))
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
            const raw = await ctx.execute<Record<string, unknown>>(document, { object: data }, asOptions(options))
            assertNoGraphQLErrors(raw)
            const result = (raw.data as Record<string, unknown>)?.[`insert_${ctx.resourceName}_one`] ?? null
            return { data: result }
        },
        updateById: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const { id, data } = payload as UpdateByIdPayload
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const document = `mutation Update${singular(ctx.resourceName)}($pk: ${ctx.resourceName}_pk_columns_input!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}_by_pk(pk_columns: $pk, _set: $set) { ${fields} } }`
            const raw = await ctx.execute<Record<string, unknown>>(document, { pk: { id }, set: data }, asOptions(options))
            assertNoGraphQLErrors(raw)
            const result = (raw.data as Record<string, unknown>)?.[`update_${ctx.resourceName}_by_pk`] ?? null
            return { data: result }
        },
        updateWhere: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const { where, data } = payload as UpdateWherePayload
            const document = `mutation UpdateWhere${singular(ctx.resourceName)}($where: ${ctx.resourceName}_bool_exp!, $set: ${ctx.resourceName}_set_input!) { update_${ctx.resourceName}(where: $where, _set: $set) { affected_rows } }`
            const raw = await ctx.execute<Record<string, { affected_rows: number }>>(document, { where, set: data }, asOptions(options))
            assertNoGraphQLErrors(raw)
            const affected = (raw.data as Record<string, { affected_rows: number }>)?.[`update_${ctx.resourceName}`]?.affected_rows ?? 0
            return { affectedRows: affected }
        },
        deleteById: async (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const { id } = payload as DeleteByIdPayload
            const document = `mutation Delete${singular(ctx.resourceName)}($id: uuid!) { delete_${ctx.resourceName}_by_pk(id: $id) { id } }`
            const raw = await ctx.execute(document, { id }, asOptions(options))
            assertNoGraphQLErrors(raw)
            return { success: true }
        },
        subscription: (ctx, payload, options) => {
            enumIdentifier(ctx.resourceName)
            const fields = resolveFields(ctx.resource, asOptions(options)?.fragment)
            const { decls, args, variables } = buildVarArgs(ctx.resourceName, payload)
            const document = `subscription On${singular(ctx.resourceName)}${decls} { ${ctx.resourceName}${args} { ${fields} } }`

            const wsUrl = toWebSocketUrl(ctx.endpoint)
            const conn = getSharedConnection(wsUrl, ctx.adminSecret, ctx.headers, ctx.poolOwner)

            const id = subscriptionId()
            addSubscription(conn, id, {
                emit: (event, data) => ctx.emit?.(event, data),
                query: document,
                variables,
            })

            return () => removeSubscription(conn, id)
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
