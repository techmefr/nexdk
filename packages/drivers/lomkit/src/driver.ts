import { toErrorPayload } from 'nexdk'
import type { AnyResource, SdkDriver, SdkEventHandler } from 'nexdk'
import { createRequest, resolveHeaders } from '@nexdk/http'
import type { HeadersResolver, HttpRequest } from '@nexdk/http'
import type {
    LomkitConfig,
    LomkitDeleteResult,
    LomkitGetResult,
    LomkitMutateResult,
    LomkitResourceApi,
} from './types.ts'

declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        lomkit: LomkitResourceApi<T>
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
        this.httpRequest = createRequest(config.fetch)
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

    async get<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitGetResult<T>> {
        const resource = this.resources.get(resourceName)
        const name = resource?.name ?? resourceName
        const urlName = encodeURIComponent(name)

        onEvent?.('request', { resource: name, payload })

        let result: LomkitGetResult<T>
        try {
            result = await this.httpRequest<LomkitGetResult<T>>(`${this.baseUrl}/${urlName}/search`, {
                method: 'POST',
                headers: await this.buildHeaders(),
                body: payload ?? {},
            })
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
        onEvent?.('success', result)
        return result
    }

    async mutate<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitMutateResult<T>> {
        const resource = this.resources.get(resourceName)
        const name = resource?.name ?? resourceName
        const urlName = encodeURIComponent(name)

        onEvent?.('request', { resource: name, payload })

        let result: LomkitMutateResult<T>
        try {
            result = await this.httpRequest<LomkitMutateResult<T>>(`${this.baseUrl}/${urlName}/mutate`, {
                method: 'POST',
                headers: await this.buildHeaders(),
                body: { mutate: [payload] },
            })
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
        onEvent?.('success', result)
        return result
    }

    async delete(
        resourceName: string,
        payload?: unknown,
        onEvent?: SdkEventHandler,
    ): Promise<LomkitDeleteResult> {
        const resource = this.resources.get(resourceName)
        const name = resource?.name ?? resourceName
        const urlName = encodeURIComponent(name)

        onEvent?.('request', { resource: name, payload })

        try {
            await this.httpRequest(`${this.baseUrl}/${urlName}`, {
                method: 'DELETE',
                headers: await this.buildHeaders(),
                body: payload,
            })
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
        onEvent?.('success', { deleted: true })
        return { success: true }
    }

    private handleError(error: unknown, onEvent?: SdkEventHandler): unknown {
        onEvent?.('error', toErrorPayload(error))
        return error
    }
}
