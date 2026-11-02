import { toErrorPayload } from 'nexdk'
import type { AnyResource, SdkDriver, SdkEventHandler } from 'nexdk'
import { createRequest, encodeResource, resolveHeaders } from '@nexdk/http'
import type { HeadersResolver, HttpRequest } from '@nexdk/http'
import { withFieldNames } from './errors.ts'
import type {
    LomkitActionPayload,
    LomkitActionResult,
    LomkitBulkResult,
    LomkitConfig,
    LomkitDeleteResult,
    LomkitDetailsResult,
    LomkitGetResult,
    LomkitMutateResult,
    LomkitResourceApi,
} from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        lomkit: LomkitResourceApi<T>
    }
}

interface Target {
    name: string
    url: string
}

export class LomkitDriver implements SdkDriver {
    readonly name = 'lomkit'

    declare readonly __apiUri: 'lomkit'

    private readonly baseUrl: string
    private readonly headersConfig: HeadersResolver | undefined
    private readonly httpRequest: HttpRequest
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: LomkitConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '')
        this.headersConfig = config.headers
        this.httpRequest = createRequest(config.fetch, { timeout: config.timeout, signal: config.signal })
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
    }

    private async buildHeaders(): Promise<Record<string, string>> {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(await resolveHeaders(this.headersConfig)),
        }
    }

    private resolveTarget(resourceName: string): Target {
        const name = this.resources.get(resourceName)?.name ?? resourceName
        return { name, url: `${this.baseUrl}/${encodeResource(name)}` }
    }

    private async sendRequest<R>(path: string, method: string, body: unknown, onEvent?: SdkEventHandler): Promise<R> {
        try {
            return await this.httpRequest<R>(path, { method, headers: await this.buildHeaders(), body })
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
    }

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T>> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitGetResult<T>>(`${url}/search`, 'POST', payload ?? {}, onEvent)
        onEvent?.('success', result)
        return result
    }

    async mutate(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitMutateResult>(
            `${url}/mutate`,
            'POST',
            { mutate: Array.isArray(payload) ? payload : [payload] },
            onEvent,
        )
        onEvent?.('success', result)
        return result
    }

    async delete(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        await this.sendRequest(url, 'DELETE', payload, onEvent)
        onEvent?.('success', { deleted: true })
        return { success: true }
    }

    async restore<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitBulkResult<T>>(`${url}/restore`, 'POST', payload, onEvent)
        onEvent?.('success', result)
        return result
    }

    async forceDelete<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitBulkResult<T>>(`${url}/force`, 'DELETE', payload, onEvent)
        onEvent?.('success', result)
        return result
    }

    async actions(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitActionResult> {
        const { name, url } = this.resolveTarget(resourceName)
        const { name: action, ...body } = (payload ?? {}) as Partial<LomkitActionPayload>
        if (typeof action !== 'string' || action === '') throw new Error(`Invalid action name: "${action ?? ''}"`)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitActionResult>(`${url}/actions/${encodeURIComponent(action)}`, 'POST', body, onEvent)
        onEvent?.('success', result)
        return result
    }

    async details(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDetailsResult> {
        const { name, url } = this.resolveTarget(resourceName)
        onEvent?.('request', { resource: name, payload })
        const result = await this.sendRequest<LomkitDetailsResult>(url, 'GET', undefined, onEvent)
        onEvent?.('success', result)
        return result
    }

    private handleError(error: unknown, onEvent?: SdkEventHandler): unknown {
        const converted = withFieldNames(error)
        onEvent?.('error', toErrorPayload(converted))
        return converted
    }
}
