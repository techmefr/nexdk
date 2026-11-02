import { HttpError } from '@nexdk/http'

const MUTATE_PREFIX = /^mutate\.\d+\./
const SEARCH_PREFIX = /^search\./
const RELATION_LEVEL = /^relations\.([^.]+)\.(?:(\d+)\.)?/
const ATTRIBUTES_PREFIX = /^attributes\./

export function fieldName(key: string): string {
    if (SEARCH_PREFIX.test(key)) return key.replace(SEARCH_PREFIX, '')
    if (!MUTATE_PREFIX.test(key)) return key
    let rest = key.replace(MUTATE_PREFIX, '')
    const path: string[] = []
    for (let level = RELATION_LEVEL.exec(rest); level !== null; level = RELATION_LEVEL.exec(rest)) {
        path.push(level[1], ...(level[2] === undefined ? [] : [level[2]]))
        rest = rest.slice(level[0].length)
    }
    return [...path, rest.replace(ATTRIBUTES_PREFIX, '')].join('.')
}

export function fieldErrors(errors: unknown): unknown {
    if (errors === null || typeof errors !== 'object' || Array.isArray(errors)) return errors
    const simple: Record<string, unknown> = {}
    for (const [key, messages] of Object.entries(errors)) {
        const name = fieldName(key)
        const known = simple[name]
        simple[name] = Array.isArray(known) && Array.isArray(messages) ? [...known, ...messages] : messages
    }
    return simple
}

export function withFieldNames(error: unknown): unknown {
    if (!(error instanceof HttpError) || error.status !== 422) return error
    return Object.assign(error, { errors: fieldErrors(error.errors) })
}
