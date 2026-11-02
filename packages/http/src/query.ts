export function toQuery(payload: unknown): string {
    if (payload === undefined || payload === null) return ''
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) for (const item of value) params.append(key, String(item))
        else params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    const query = params.toString().replace(/\+/g, '%20')
    return query ? `?${query}` : ''
}

export function splitId(payload: unknown): { id: number | string; body: Record<string, unknown> } {
    const { id, ...body } = (payload ?? {}) as { id: number | string } & Record<string, unknown>
    return { id, body }
}

function encodeSegment(value: string, label: string): string {
    if (value === '' || value === '.' || value === '..') throw new Error(`Invalid ${label}: "${value}"`)
    return encodeURIComponent(value)
}

export function encodeId(id: number | string): string {
    return encodeSegment(String(id ?? ''), 'id')
}

export function encodeResource(name: string): string {
    return encodeSegment(String(name ?? ''), 'resource name')
}
