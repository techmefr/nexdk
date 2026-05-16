import type { AnyResource, PilotaDriver, PilotaEventHandler } from '@pilota/core'
import type { GraphQLOptions, NhostConfig, NhostQueryResult } from './types.ts'

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
            const result = await this.execute<T>(document, payload as Record<string, unknown>)
            onEvent?.('success', result)
            return result
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    async mutation<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
        options?: GraphQLOptions,
    ): Promise<NhostQueryResult<T>> {
        onEvent?.('request', { resource: resourceName, payload })

        const resource = this.resources.get(resourceName)
        const fields = this.resolveFields(resource, options?.fragment)
        const isUpdate = payload !== null && typeof payload === 'object' && 'id' in (payload as object)
        const operationName = isUpdate
            ? `Update${this.singular(resourceName)}`
            : `Create${this.singular(resourceName)}`
        const document = `mutation ${operationName} { ${resourceName}${this.buildArgs(payload)} { ${fields} } }`

        try {
            const result = await this.execute<T>(document, payload as Record<string, unknown>)
            onEvent?.('success', result)
            return result
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
        const document = `subscription On${this.singular(resourceName)} { ${resourceName}${this.buildArgs(payload)} { ${fields} } }`

        const ws = new WebSocket(this.endpoint.replace(/^http/, 'ws'), 'graphql-ws')
        let subscriptionId: string | null = null

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'connection_init' }))
            subscriptionId = Math.random().toString(36).slice(2)
            ws.send(
                JSON.stringify({
                    id: subscriptionId,
                    type: 'subscribe',
                    payload: { query: document, variables: payload ?? {} },
                }),
            )
        }

        ws.onmessage = event => {
            const message = JSON.parse(event.data as string) as {
                type: string
                payload?: unknown
            }
            if (message.type === 'next') {
                onEvent?.('data', message.payload)
            }
            if (message.type === 'error') {
                onEvent?.('error', message.payload)
            }
        }

        return () => {
            if (subscriptionId !== null) {
                ws.send(JSON.stringify({ id: subscriptionId, type: 'complete' }))
            }
            ws.close()
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
