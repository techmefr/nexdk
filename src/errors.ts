export interface SdkErrorInit {
    status?: number
    errors?: unknown
    data?: unknown
}

export interface ErrorEventPayload {
    message: string
    status?: number
    errors?: unknown
}

export class SdkError extends Error {
    readonly status: number | undefined
    readonly errors: unknown
    readonly data: unknown

    constructor(message: string, init: SdkErrorInit = {}) {
        super(message)
        this.name = 'SdkError'
        this.status = init.status
        this.errors = init.errors
        this.data = init.data
    }
}

export class ResponseValidationError extends SdkError {
    constructor(resourceName: string, errors: Record<string, string[]>, data: unknown) {
        super(`Response does not match the schema of resource "${resourceName}"`, { status: 0, errors, data })
        this.name = 'ResponseValidationError'
    }
}

export function toErrorPayload(error: unknown): ErrorEventPayload {
    if (error instanceof Error) {
        const candidate = error as Error & { status?: unknown; errors?: unknown; data?: unknown }
        const payload: ErrorEventPayload = { message: error.message }
        if (typeof candidate.status === 'number') payload.status = candidate.status
        const errors =
            candidate.errors !== undefined
                ? candidate.errors
                : typeof candidate.status === 'number' && !(error instanceof SdkError)
                  ? candidate.data
                  : undefined
        if (errors !== undefined) payload.errors = errors
        return payload
    }
    return { message: String(error) }
}
