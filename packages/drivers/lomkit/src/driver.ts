import { traceCall } from 'nexdk'
import type { AnyResource, SdkCallOptions, SdkDriver, SdkEventHandler } from 'nexdk'
import { createRequest, encodeResource, resolveHeaders, withCallOptions } from '@nexdk/http'
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

type Send = <R>(path: string, method: string, body: unknown) => Promise<R>

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
        this.httpRequest = createRequest(config.fetch, {
            timeout: config.timeout,
            signal: config.signal,
            onResponse: config.onResponse,
        })
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
        target: { resourceName: string; payload: unknown; onEvent: SdkEventHandler | undefined; options: unknown },
        run: (send: Send) => Promise<R>,
    ): Promise<R> {
        const name = this.resources.get(target.resourceName)?.name ?? target.resourceName
        const httpRequest = withCallOptions(this.httpRequest, target.options)
        return traceCall({ emit: target.onEvent, resource: name, payload: target.payload }, () => {
            const url = `${this.baseUrl}/${encodeResource(name)}`
            return run((path, verb, body) => this.sendRequest(httpRequest, `${url}${path}`, verb, body))
        })
    }

    private async sendRequest<R>(httpRequest: HttpRequest, path: string, method: string, body: unknown): Promise<R> {
        try {
            return await httpRequest<R>(path, { method, headers: await this.buildHeaders(), body })
        } catch (error) {
            throw withFieldNames(error)
        }
    }

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitGetResult<T>> {
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitGetResult<T>>('/search', 'POST', payload ?? {}),
        )
    }

    async mutate(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitMutateResult> {
        const body = { mutate: Array.isArray(payload) ? payload : [payload] }
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitMutateResult>('/mutate', 'POST', body),
        )
    }

    async delete<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitDeleteResult<T>> {
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitDeleteResult<T>>('', 'DELETE', payload),
        )
    }

    async restore<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitBulkResult<T>> {
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitBulkResult<T>>('/restore', 'POST', payload),
        )
    }

    async forceDelete<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitBulkResult<T>> {
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitBulkResult<T>>('/force', 'DELETE', payload),
        )
    }

    async actions(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitActionResult> {
        const { name: action, ...body } = (payload ?? {}) as Partial<LomkitActionPayload>
        if (typeof action !== 'string' || action === '') throw new Error(`Invalid action name: "${action ?? ''}"`)
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitActionResult>(`/actions/${encodeURIComponent(action)}`, 'POST', body),
        )
    }

    async details(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
        options?: SdkCallOptions,
    ): Promise<LomkitDetailsResult> {
        return this.call({ resourceName, payload, onEvent, options }, send =>
            send<LomkitDetailsResult>('', 'GET', undefined),
        )
    }
}
