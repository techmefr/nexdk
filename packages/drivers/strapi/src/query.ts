const MAX_DEPTH = 16

function flatten(
    prefix: string,
    value: unknown,
    out: Array<[string, string]>,
    ancestors: WeakSet<object>,
    depth: number,
): void {
    if (value === undefined || value === null) return
    if (typeof value !== 'object') {
        out.push([prefix, String(value)])
        return
    }
    if (depth > MAX_DEPTH) throw new Error(`Strapi query exceeds the maximum depth of ${MAX_DEPTH}`)
    if (ancestors.has(value)) throw new Error('Strapi query contains a circular reference')
    ancestors.add(value)
    if (Array.isArray(value)) {
        value.forEach((item, index) => flatten(`${prefix}[${index}]`, item, out, ancestors, depth + 1))
    } else {
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            flatten(`${prefix}[${key}]`, nested, out, ancestors, depth + 1)
        }
    }
    ancestors.delete(value)
}

export function toStrapiQuery(payload: unknown): string {
    if (payload === undefined || payload === null) return ''
    const pairs: Array<[string, string]> = []
    const ancestors = new WeakSet<object>()
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        flatten(key, value, pairs, ancestors, 1)
    }
    if (pairs.length === 0) return ''
    const params = new URLSearchParams()
    for (const [key, value] of pairs) params.append(key, value)
    return `?${params.toString()}`
}
