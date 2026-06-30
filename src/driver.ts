import type { PilotaEventHandler } from 'beepr'
import type { AnyResource, PilotaDriver } from 'nexdk'
import { parseMockList } from 'chaff'
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

// Error thrown after handleError has already emitted the typed 'error' event,
// so the method's catch block does not emit a second, duplicate event.
class LomkitHttpError extends Error {}

export class LomkitDriver implements PilotaDriver {
    readonly name = 'lomkit'

    // Phantom marker: the SDK reads this uri to look up LomkitResourceApi<T> in
    // the augmented ResourceApiKinds registry. Never used at runtime.
    declare readonly __apiUri: 'lomkit'

    private readonly baseUrl: string
    private readonly headers: Record<string, string>
    private readonly resources = new Map<string, AnyResource>()

    constructor(config: LomkitConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '')
        this.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...config.headers,
        }
    }

    bindResource(resourceName: string, resource: AnyResource): void {
        this.resources.set(resourceName, resource)
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
            return { data: parseMockList(resource, mock) as T[] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const response = await fetch(`${this.baseUrl}/${urlName}/search`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload ?? {}),
            })

            if (!response.ok) {
                throw await this.handleError(response, onEvent)
            }

            const result = (await response.json()) as LomkitGetResult<T>
            onEvent?.('success', result)
            return result
        } catch (error) {
            if (!(error instanceof LomkitHttpError)) {
                onEvent?.('error', { message: (error as Error).message })
            }
            throw error
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
            return { data: parseMockList(resource, mock) as T[] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const response = await fetch(`${this.baseUrl}/${urlName}/mutate`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ mutate: [payload] }),
            })

            if (!response.ok) {
                throw await this.handleError(response, onEvent)
            }

            const result = (await response.json()) as LomkitMutateResult<T>
            onEvent?.('success', result)
            return result
        } catch (error) {
            if (!(error instanceof LomkitHttpError)) {
                onEvent?.('error', { message: (error as Error).message })
            }
            throw error
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
            const response = await fetch(`${this.baseUrl}/${urlName}`, {
                method: 'DELETE',
                headers: this.headers,
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                throw await this.handleError(response, onEvent)
            }

            onEvent?.('success', { deleted: true })
            return { success: true }
        } catch (error) {
            if (!(error instanceof LomkitHttpError)) {
                onEvent?.('error', { message: (error as Error).message })
            }
            throw error
        }
    }

    // Emit the typed 'error' event with the full HTTP / validation detail and
    // return the matching error for the caller to throw.
    private async handleError(response: Response, onEvent?: PilotaEventHandler): Promise<LomkitHttpError> {
        if (response.status === 422) {
            const body = (await response.json()) as LomkitValidationError
            onEvent?.('error', { message: body.message, errors: body.errors })
            return new LomkitHttpError(body.message)
        }
        const message = `HTTP ${response.status}`
        onEvent?.('error', { message })
        return new LomkitHttpError(message)
    }
}
