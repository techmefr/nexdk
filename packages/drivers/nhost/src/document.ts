import type { AnyResource } from 'nexdk'

export function argType(resourceName: string, argName: string): string {
    switch (argName) {
        case 'where': return `${resourceName}_bool_exp`
        case 'order_by': return `[${resourceName}_order_by!]`
        case 'limit':
        case 'offset': return 'Int'
        case 'distinct_on': return `[${resourceName}_select_column!]`
        default: return 'jsonb'
    }
}

export function resolveFields(resource: AnyResource | undefined, fragmentKey?: string): string {
    if (resource === undefined) return 'id'

    const key = fragmentKey ?? 'default'
    const fragment = resource.fragments[key]

    if (fragment !== undefined && fragment.length > 0) {
        return fragment.join(' ')
    }

    const shape = (resource.schema as { shape?: Record<string, unknown> }).shape
    if (shape !== undefined) {
        return Object.keys(shape).join(' ')
    }

    return 'id'
}

export function buildQueryName(resourceName: string): string {
    return `Get${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`
}

export function singular(resourceName: string): string {
    const name = resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
    if (/(ss|us|is)$/.test(name)) return name
    if (/ies$/.test(name)) return `${name.slice(0, -3)}y`
    return name.endsWith('s') ? name.slice(0, -1) : name
}

export function buildVarArgs(
    resourceName: string,
    payload: unknown,
): { decls: string; args: string; variables: Record<string, unknown> } {
    if (!payload || typeof payload !== 'object' || Object.keys(payload as object).length === 0) {
        return { decls: '', args: '', variables: {} }
    }
    const decls: string[] = []
    const args: string[] = []
    const variables: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        enumIdentifier(key)
        decls.push(`$${key}: ${argType(resourceName, key)}`)
        args.push(`${key}: $${key}`)
        variables[key] = value
    }
    return { decls: `(${decls.join(', ')})`, args: `(${args.join(', ')})`, variables }
}

export function enumIdentifier(name: string): string {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name)) {
        throw new Error(`Invalid GraphQL enum identifier: ${name}`)
    }
    return name
}
