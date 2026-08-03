import type { AnyResource } from 'nexdk'

// GraphQL type for a top-level argument of a list query / subscription.
// We map well-known Hasura argument names to their generated input types so
// user-supplied values travel as variables instead of being interpolated.
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

// Resolve the selection set for a resource: a named fragment when present,
// otherwise the schema shape keys, falling back to `id`.
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

// Operation name for a list query (Get + capitalized resource name).
export function buildQueryName(resourceName: string): string {
    return `Get${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`
}

// Pragmatic singularization used only to build a mutation / subscription
// operation name. Not a full pluralization library: leaves ss/us/is words alone
// (status, bus, axis), maps ies -> y (categories -> category), and otherwise
// strips a trailing s.
export function singular(resourceName: string): string {
    const name = resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
    if (/(ss|us|is)$/.test(name)) return name
    if (/ies$/.test(name)) return `${name.slice(0, -3)}y`
    return name.endsWith('s') ? name.slice(0, -1) : name
}

// Build typed variable declarations and the matching argument list for a
// list query / subscription. Each top-level argument value becomes a GraphQL
// variable so no user-supplied scalar is ever interpolated into the document.
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
        decls.push(`$${key}: ${argType(resourceName, key)}`)
        args.push(`${key}: $${key}`)
        variables[key] = value
    }
    return { decls: `(${decls.join(', ')})`, args: `(${args.join(', ')})`, variables }
}

// Validate a developer-controlled GraphQL enum identifier (constraint name,
// column name). Enums are emitted inline, so reject anything that is not a bare
// GraphQL name to prevent injection through misconfigured developer code.
export function enumIdentifier(name: string): string {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name)) {
        throw new Error(`Invalid GraphQL enum identifier: ${name}`)
    }
    return name
}
