import type { AnyResource, PilotaDriver, PilotaEventHandler } from '@pilota/core'
import { parseMock } from '@pilota/core'
import type {
    LomkitConfig,
    LomkitDeleteResult,
    LomkitGetResult,
    LomkitMutateResult,
    LomkitValidationError,
} from './types.ts'

export class LomkitDriver implements PilotaDriver {
    readonly name = 'lomkit'

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
            return { data: [resource.schema.parse(mock) as T] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const response = await fetch(`${this.baseUrl}/${urlName}/search`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload ?? {}),
            })

            if (!response.ok) {
                await this.handleError(response, onEvent)
                return { data: [] }
            }

            const result = (await response.json()) as LomkitGetResult<T>
            onEvent?.('success', result)
            return result
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
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
            return { data: [parseMock(resource, mock) as T] }
        }

        onEvent?.('request', { resource: urlName, payload })

        try {
            const response = await fetch(`${this.baseUrl}/${urlName}/mutate`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ mutate: [payload] }),
            })

            if (!response.ok) {
                await this.handleError(response, onEvent)
                return { data: [] }
            }

            const result = (await response.json()) as LomkitMutateResult<T>
            onEvent?.('success', result)
            return result
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
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
                await this.handleError(response, onEvent)
                return { success: false }
            }

            onEvent?.('success', { deleted: true })
            return { success: true }
        } catch (error) {
            onEvent?.('error', { message: (error as Error).message })
            throw error
        }
    }

    private async handleError(response: Response, onEvent?: PilotaEventHandler): Promise<void> {
        if (response.status === 422) {
            const body = (await response.json()) as LomkitValidationError
            onEvent?.('error', { message: body.message, errors: body.errors })
            return
        }
        onEvent?.('error', { message: `HTTP ${response.status}` })
    }
}
