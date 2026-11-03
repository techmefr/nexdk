const JSON_TYPE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json$/i
const TEXT_TYPES = new Set(['image/svg', 'application/xml', 'application/xhtml', 'application/html'])
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])
const JSON_SIGNATURE = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/
const SUSPECT_KEY = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:|"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/
const LITERALS = new Map<string, unknown>([
    ['true', true],
    ['false', false],
    ['undefined', undefined],
    ['null', null],
    ['nan', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['-infinity', Number.NEGATIVE_INFINITY],
])

type PolyfilledResponse = Response & { _bodyInit?: unknown }

function dropPollution(key: string, value: unknown): unknown {
    if (key === '__proto__' || (key === 'constructor' && value && typeof value === 'object' && 'prototype' in value)) return undefined
    return value
}

export function parseJson(text: string): unknown {
    if (text[0] === '"' && text[text.length - 1] === '"' && !text.includes('\\')) return text.slice(1, -1)
    const trimmed = text.trim()
    if (trimmed.length <= 9 && LITERALS.has(trimmed.toLowerCase())) return LITERALS.get(trimmed.toLowerCase())
    if (!JSON_SIGNATURE.test(text)) return text
    try {
        return SUSPECT_KEY.test(text) ? JSON.parse(text, dropPollution) : JSON.parse(text)
    } catch {
        return text
    }
}

export function isJsonBody(value: unknown): boolean {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
    if (value === null || typeof value !== 'object') return false
    if (Array.isArray(value)) return true
    if ((value as { buffer?: unknown }).buffer || value instanceof FormData || value instanceof URLSearchParams) return false
    return value.constructor?.name === 'Object' || typeof (value as { toJSON?: unknown }).toJSON === 'function'
}

export function isStreamBody(value: object): boolean {
    const body = value as { pipeTo?: unknown; pipe?: unknown }
    return typeof body.pipeTo === 'function' || typeof body.pipe === 'function'
}

export async function readBody(response: PolyfilledResponse, method: string | undefined): Promise<unknown> {
    const body = response.body || response._bodyInit
    if (!body || NULL_BODY_STATUSES.has(response.status) || method === 'HEAD') return undefined
    const header = response.headers.get('content-type') || ''
    const type = header.split(';')[0]
    if (header === '' || JSON_TYPE.test(type)) return parseJson(await response.text())
    if (type === 'text/event-stream') return body
    if (TEXT_TYPES.has(type) || type.startsWith('text/')) return response.text()
    return response.blob()
}
