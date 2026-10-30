// Serialize a query object into a URL search string ("" when empty).
export function toQuery(payload: unknown): string {
    if (payload === undefined || payload === null) return ''
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) for (const item of value) params.append(key, String(item))
        else params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    const query = params.toString()
    return query ? `?${query}` : ''
}

// Split an id payload into the id (for the URL) and the remaining body fields.
export function splitId(payload: unknown): { id: number | string; body: Record<string, unknown> } {
    const { id, ...body } = (payload ?? {}) as { id: number | string } & Record<string, unknown>
    return { id, body }
}

// URL-encode an id for use as a single path segment. Rejects empty ids and the
// dot segments, which URL normalisation would resolve to a parent path.
export function encodeId(id: number | string): string {
    const value = String(id ?? '')
    if (value === '' || value === '.' || value === '..') throw new Error(`Invalid id: "${value}"`)
    return encodeURIComponent(value)
}
