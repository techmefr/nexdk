import { SdkError, failureKind } from 'nexdk'
import type { GraphQLError } from './types.ts'

const statusByCode: Record<string, number> = {
    'access-denied': 403,
    'permission-denied': 403,
    'permission-error': 403,
    'invalid-jwt': 401,
    'jwt-invalid': 401,
    'jwt-invalid-claims': 401,
    'jwt-missing-role-claims': 401,
    'validation-failed': 400,
    'parse-failed': 400,
    'bad-request': 400,
    'data-exception': 400,
    'invalid-headers': 400,
    'not-supported': 400,
    'not-found': 404,
    'constraint-violation': 409,
}

export function graphQLStatus(errors: GraphQLError[]): number {
    for (const error of errors) {
        const code = error.extensions?.code
        if (typeof code === 'string' && code in statusByCode) return statusByCode[code] as number
    }
    return 500
}

export function graphQLError(errors: GraphQLError[], data: unknown): SdkError {
    const message = errors.map(error => error.message).join('; ')
    return new SdkError(message, { status: graphQLStatus(errors), errors, data, kind: 'http' })
}

export function failureError(error: unknown, signal: AbortSignal | undefined): SdkError {
    const message = error instanceof Error ? error.message : String(error)
    return new SdkError(message, { status: 0, kind: failureKind(error, signal), cause: error })
}

export function unreadableError(response: Response, error: unknown, signal: AbortSignal | undefined): SdkError {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return new SdkError(`response body unreadable: ${message}`, { status: response.status, kind: failureKind(error, signal), cause: error })
}

export async function toHttpError(response: Response): Promise<SdkError> {
    let data: unknown
    try {
        data = await response.json()
    } catch {
        data = undefined
    }
    const body = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
    const errors = body?.errors
    return new SdkError(`HTTP ${response.status}`, { status: response.status, errors, data, kind: 'http' })
}
