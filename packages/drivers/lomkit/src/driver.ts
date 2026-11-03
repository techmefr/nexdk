import { traceCall } from 'nexdk'
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
    interface ThrowingResourceApiKinds<T> {
        lomkit: LomkitResourceApi<T, true>
    }
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

    private call<R>(
        resourceName: string,
        payload: unknown,
        onEvent: SdkEventHandler | undefined,
        send: (url: string) => Promise<R>,
    ): Promise<R> {
        const name = this.resources.get(resourceName)?.name ?? resourceName
        return traceCall({ emit: onEvent, resource: name, payload }, () => send(`${this.baseUrl}/${encodeResource(name)}`))
    }

    private async sendRequest<R>(path: string, method: string, body: unknown): Promise<R> {
        try {
            return await this.httpRequest<R>(path, { method, headers: await this.buildHeaders(), body })
        } catch (error) {
            throw withFieldNames(error)
        }
    }

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T>> {
        return this.call(resourceName, payload, onEvent, url =>
            this.sendRequest<LomkitGetResult<T>>(`${url}/search`, 'POST', payload ?? {}),
        )
    }

    async mutate(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult> {
        const body = { mutate: Array.isArray(payload) ? payload : [payload] }
        return this.call(resourceName, payload, onEvent, url => this.sendRequest<LomkitMutateResult>(`${url}/mutate`, 'POST', body))
    }

    async delete(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult> {
        return this.call(resourceName, payload, onEvent, async url => {
            await this.sendRequest(url, 'DELETE', payload)
            return { success: true }
        })
    }

    async restore<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>> {
        return this.call(resourceName, payload, onEvent, url =>
            this.sendRequest<LomkitBulkResult<T>>(`${url}/restore`, 'POST', payload),
        )
    }

    async forceDelete<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitBulkResult<T>> {
        return this.call(resourceName, payload, onEvent, url =>
            this.sendRequest<LomkitBulkResult<T>>(`${url}/force`, 'DELETE', payload),
        )
    }

    async actions(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitActionResult> {
        const { name: action, ...body } = (payload ?? {}) as Partial<LomkitActionPayload>
        if (typeof action !== 'string' || action === '') throw new Error(`Invalid action name: "${action ?? ''}"`)
        return this.call(resourceName, payload, onEvent, url =>
            this.sendRequest<LomkitActionResult>(`${url}/actions/${encodeURIComponent(action)}`, 'POST', body),
        )
    }

    async details(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDetailsResult> {
        return this.call(resourceName, payload, onEvent, url => this.sendRequest<LomkitDetailsResult>(url, 'GET', undefined))
    }
}
