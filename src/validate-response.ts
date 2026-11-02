import { ResponseValidationError } from './errors.ts'
import type { StandardSchemaV1 } from './standard-schema.ts'
import type { AnyResource } from './types.ts'

export const VALIDATED_METHODS: ReadonlySet<string> = new Set(['get', 'find', 'create', 'update'])

type FieldErrors = Record<string, string[]>

const NO_FIELD = '_'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const isIndex = (key: string | symbol): boolean => typeof key === 'string' && /^\d+$/.test(key)

function addIssues(errors: FieldErrors, issues: ReadonlyArray<StandardSchemaV1.Issue>, prefix: string[]): void {
    for (const issue of issues) {
        const segments = (issue.path ?? []).map(segment => String(typeof segment === 'object' ? segment.key : segment))
        const path = [...prefix, ...segments]
        const field = path.length === 0 ? NO_FIELD : path.join('.')
        errors[field] = [...(errors[field] ?? []), issue.message]
    }
}

async function validateValue(resource: AnyResource, value: unknown, prefix: string[], errors: FieldErrors): Promise<unknown> {
    const result = await resource.schema['~standard'].validate(value)
    if (result.issues === undefined) return result.value
    addIssues(errors, result.issues, prefix)
    return value
}

async function validateRows(resource: AnyResource, rows: unknown[], prefix: string[], errors: FieldErrors): Promise<unknown[]> {
    const validated: unknown[] = []
    for (const [index, row] of rows.entries()) validated.push(await validateValue(resource, row, [...prefix, String(index)], errors))
    for (const key of Reflect.ownKeys(rows)) {
        const descriptor = Object.getOwnPropertyDescriptor(rows, key)
        if (key !== 'length' && !isIndex(key) && descriptor !== undefined) Object.defineProperty(validated, key, descriptor)
    }
    return validated
}

async function validateShape(resource: AnyResource, method: string, result: unknown, errors: FieldErrors): Promise<unknown> {
    if (method !== 'get') return validateValue(resource, result, [], errors)
    if (Array.isArray(result)) return validateRows(resource, result, [], errors)
    if (isRecord(result) && Array.isArray(result.data)) {
        return { ...result, data: await validateRows(resource, result.data, ['data'], errors) }
    }
    return validateValue(resource, result, [], errors)
}

export async function validateResponse(resource: AnyResource, method: string, result: unknown): Promise<unknown> {
    const errors: FieldErrors = {}
    const validated = await validateShape(resource, method, result, errors)
    if (Object.keys(errors).length > 0) throw new ResponseValidationError(resource.name, errors, result)
    return validated
}
