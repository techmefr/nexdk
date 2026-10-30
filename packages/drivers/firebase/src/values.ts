export type FirestoreValue =
    | { nullValue: null }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number }
    | { stringValue: string }
    | { timestampValue: string }
    | { arrayValue: { values?: FirestoreValue[] } }
    | { mapValue: { fields?: Record<string, FirestoreValue> } }

export interface FirestoreDocument {
    name: string
    fields?: Record<string, FirestoreValue>
}

export function encodeValue(value: unknown): FirestoreValue {
    if (value === null || value === undefined) return { nullValue: null }
    if (typeof value === 'boolean') return { booleanValue: value }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
    }
    if (typeof value === 'string') return { stringValue: value }
    if (value instanceof Date) return { timestampValue: value.toISOString() }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } }
}

export function encodeFields(record: Record<string, unknown>): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {}
    for (const [key, value] of Object.entries(record)) {
        if (value !== undefined) fields[key] = encodeValue(value)
    }
    return fields
}

export function decodeValue(value: FirestoreValue): unknown {
    if ('nullValue' in value) return null
    if ('booleanValue' in value) return value.booleanValue
    if ('integerValue' in value) return Number(value.integerValue)
    if ('doubleValue' in value) return value.doubleValue
    if ('stringValue' in value) return value.stringValue
    if ('timestampValue' in value) return value.timestampValue
    if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
    if ('mapValue' in value) return decodeFields(value.mapValue.fields)
    return Object.values(value)[0]
}

export function decodeFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
    const record: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields ?? {})) {
        Object.defineProperty(record, key, {
            value: decodeValue(value),
            enumerable: true,
            writable: true,
            configurable: true,
        })
    }
    return record
}

export function decodeDocument(document: FirestoreDocument): Record<string, unknown> {
    const id = document.name.slice(document.name.lastIndexOf('/') + 1)
    return { ...decodeFields(document.fields), id }
}
