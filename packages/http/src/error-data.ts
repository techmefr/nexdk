const NO_FIELD = '_'

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined
}

function joined(value: unknown): string | undefined {
    if (!Array.isArray(value)) return text(value)
    const parts = value.filter((item): item is string => typeof item === 'string' && item !== '')
    return parts.length > 0 ? parts.join(', ') : undefined
}

export function messageFromData(data: unknown): string | undefined {
    if (!isRecord(data)) return undefined
    const nested = data.error
    const fromNested = isRecord(nested) ? (joined(nested.message) ?? joined(nested.details)) : text(nested)
    return joined(data.message) ?? text(data.detail) ?? fromNested ?? text(data.title)
}

function addIssue(fields: Record<string, string[]>, field: string, message: string): void {
    const key = field === '' ? NO_FIELD : field
    fields[key] = [...(fields[key] ?? []), message]
}

function fromViolations(violations: unknown): Record<string, string[]> | undefined {
    if (!Array.isArray(violations)) return undefined
    const fields: Record<string, string[]> = {}
    for (const violation of violations) {
        if (!isRecord(violation)) continue
        const message = text(violation.message)
        if (message !== undefined) addIssue(fields, text(violation.propertyPath) ?? '', message)
    }
    return Object.keys(fields).length > 0 ? fields : undefined
}

function fromStrapi(error: unknown): Record<string, string[]> | undefined {
    if (!isRecord(error) || !isRecord(error.details) || !Array.isArray(error.details.errors)) return undefined
    const fields: Record<string, string[]> = {}
    for (const issue of error.details.errors) {
        if (!isRecord(issue)) continue
        const message = text(issue.message)
        if (message === undefined) continue
        addIssue(fields, Array.isArray(issue.path) ? issue.path.join('.') : (text(issue.path) ?? ''), message)
    }
    return Object.keys(fields).length > 0 ? fields : undefined
}

const PROPERTY = '[a-z_$][\\w$]*(?:\\.[\\w$]+)*'
const PROPERTY_FIRST = new RegExp(`^(${PROPERTY}) (?:must|should|has|is|contains|cannot|does)\\b`)
const EACH_VALUE = new RegExp(`^each value in (${PROPERTY}) `)
const UNKNOWN_PROPERTY = new RegExp(`^property (${PROPERTY}) should not exist$`)

function nestField(message: string): string {
    return (UNKNOWN_PROPERTY.exec(message) ?? EACH_VALUE.exec(message) ?? PROPERTY_FIRST.exec(message))?.[1] ?? ''
}

function fromNest(data: Record<string, unknown>): Record<string, string[]> | undefined {
    if (typeof data.statusCode !== 'number' || typeof data.error !== 'string' || !Array.isArray(data.message)) return undefined
    const fields: Record<string, string[]> = {}
    for (const message of data.message) if (typeof message === 'string' && message !== '') addIssue(fields, nestField(message), message)
    return Object.keys(fields).length > 0 ? fields : undefined
}

function fromFieldMap(map: unknown): Record<string, string[]> | undefined {
    if (!isRecord(map)) return undefined
    const entries = Object.entries(map)
    if (entries.length === 0) return undefined
    const fields: Record<string, string[]> = {}
    for (const [field, issue] of entries) {
        if (!isRecord(issue) || typeof issue.message !== 'string') return undefined
        fields[field] = [issue.message]
    }
    return fields
}

function normalized(errors: unknown): unknown {
    if (!isRecord(errors)) return errors
    const entries = Object.entries(errors)
    if (!entries.every(([, value]) => typeof value === 'string' || Array.isArray(value))) return errors
    return Object.fromEntries(entries.map(([field, value]) => [field, typeof value === 'string' ? [value] : value]))
}

export function errorsFromData(data: unknown): unknown {
    if (!isRecord(data)) return undefined
    if (data.errors !== undefined) return normalized(data.errors)
    return fromViolations(data.violations) ?? fromStrapi(data.error) ?? fromNest(data) ?? fromFieldMap(data.data)
}
