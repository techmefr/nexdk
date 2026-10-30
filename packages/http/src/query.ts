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

export function splitId(payload: unknown): { id: number | string; body: Record<string, unknown> } {
    const { id, ...body } = (payload ?? {}) as { id: number | string } & Record<string, unknown>
    return { id, body }
}

export function encodeId(id: number | string): string {
    const value = String(id ?? '')
    if (value === '' || value === '.' || value === '..') throw new Error(`Invalid id: "${value}"`)
    return encodeURIComponent(value)
}
