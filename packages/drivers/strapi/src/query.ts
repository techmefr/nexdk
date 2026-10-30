function flatten(prefix: string, value: unknown, out: Array<[string, string]>): void {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
        value.forEach((item, index) => flatten(`${prefix}[${index}]`, item, out))
        return
    }
    if (typeof value === 'object') {
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            flatten(`${prefix}[${key}]`, nested, out)
        }
        return
    }
    out.push([prefix, String(value)])
}

export function toStrapiQuery(payload: unknown): string {
    if (payload === undefined || payload === null) return ''
    const pairs: Array<[string, string]> = []
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        flatten(key, value, pairs)
    }
    if (pairs.length === 0) return ''
    const params = new URLSearchParams()
    for (const [key, value] of pairs) params.append(key, value)
    return `?${params.toString()}`
}
