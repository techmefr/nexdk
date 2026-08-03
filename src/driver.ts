import type { AnyResource, PilotaDriver, PilotaEventHandler } from 'nexdk'
import { parseMockList } from 'chaff'
import { HttpError, request, resolveHeaders } from '@nexdk/http'
import type { HeadersResolver } from '@nexdk/http'
import type {
    LomkitConfig,
    LomkitDeleteResult,
    LomkitGetResult,
    LomkitMutateResult,
    LomkitResourceApi,
    LomkitValidationError,
} from './types.ts'

// Register the lomkit per-resource API in core's registry so the typed SDK can
// resolve `sdk.lomkit.<resource>` to LomkitResourceApi<T>.
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        lomkit: LomkitResourceApi<T>
    }
}

export class LomkitDriver implements PilotaDriver {
    readonly name = 'lomkit'

    // Phantom marker: the SDK reads this uri to look up LomkitResourceApi<T> in
    // the augmented ResourceApiKinds registry. Never used at runtime.
    declare readonly __apiUri: 'lomkit'

    private readonly baseUrl: string
    private readonly headersConfig: HeadersResolver | undefined
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: LomkitConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '')
        this.headersConfig = config.headers
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
    }

    // Base headers merged with the per-request resolved headers. Resolved on
    // every request so a function-form config can return a refreshed token.
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
        onEvent?: PilotaEventHandler,
        mock?: unknown,
    ): Promise<LomkitGetResult<T>> {
        const resource = this.resources.get(resourceName)
        const urlName = resource?.name ?? resourceName

        if (mock !== undefined && resource !== undefined) {
            return { data: (await parseMockList(resource, mock)) as T[] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const result = await request<LomkitGetResult<T>>(`${this.baseUrl}/${urlName}/search`, {
                method: 'POST',
                headers: await this.buildHeaders(),
                body: payload ?? {},
            })
            onEvent?.('success', result)
            return result
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
    }

    async mutate<T>(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
        mock?: unknown,
    ): Promise<LomkitMutateResult<T>> {
        const resource = this.resources.get(resourceName)
        const urlName = resource?.name ?? resourceName

        if (mock !== undefined && resource !== undefined) {
            return { data: (await parseMockList(resource, mock)) as T[] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const result = await request<LomkitMutateResult<T>>(`${this.baseUrl}/${urlName}/mutate`, {
                method: 'POST',
                headers: await this.buildHeaders(),
                body: { mutate: [payload] },
            })
            onEvent?.('success', result)
            return result
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
    }

    async delete(
        resourceName: string,
        payload?: unknown,
        onEvent?: PilotaEventHandler,
    ): Promise<LomkitDeleteResult> {
        const resource = this.resources.get(resourceName)
        const urlName = resource?.name ?? resourceName

        onEvent?.('request', { resource: urlName, payload })

        try {
            await request(`${this.baseUrl}/${urlName}`, {
                method: 'DELETE',
                headers: await this.buildHeaders(),
                body: payload,
            })
            onEvent?.('success', { deleted: true })
            return { success: true }
        } catch (error) {
            throw this.handleError(error, onEvent)
        }
    }

    // Emit the typed 'error' event with the full HTTP / validation detail and
    // return the matching error for the caller to throw. A 422 carries a Lomkit
    // validation payload (parsed by @nexdk/http's `request` into `HttpError.data`);
    // anything else (other HTTP status, network failure) is a plain HTTP error.
    private handleError(error: unknown, onEvent?: PilotaEventHandler): Error {
        if (error instanceof HttpError && error.status === 422) {
            const body = error.data as LomkitValidationError
            onEvent?.('error', { message: body.message, errors: body.errors })
            return new Error(body.message)
        }
        const message = error instanceof HttpError ? error.message : (error as Error).message
        onEvent?.('error', { message })
        return new Error(message)
    }
}
