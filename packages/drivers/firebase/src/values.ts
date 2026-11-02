export type FirestoreValue =
    | { nullValue: null }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number | string }
    | { stringValue: string }
    | { timestampValue: string }
    | { arrayValue: { values?: FirestoreValue[] } }
    | { mapValue: { fields?: Record<string, FirestoreValue> } }

export interface FirestoreDocument {
    name: string
    fields?: Record<string, FirestoreValue>
}

export const deleteField: unique symbol = Symbol('nexdk.firebase.deleteField')

const NON_FINITE = new Map<number, string>([
    [Number.POSITIVE_INFINITY, 'Infinity'],
    [Number.NEGATIVE_INFINITY, '-Infinity'],
])

function encodeNumber(value: number): FirestoreValue {
    if (Number.isSafeInteger(value)) return { integerValue: String(value) }
    if (Number.isNaN(value)) return { doubleValue: 'NaN' }
    return { doubleValue: NON_FINITE.get(value) ?? value }
}

export function encodeValue(value: unknown): FirestoreValue {
    if (value === null || value === undefined) return { nullValue: null }
    if (typeof value === 'boolean') return { booleanValue: value }
    if (typeof value === 'bigint') return { integerValue: value.toString() }
    if (typeof value === 'number') return encodeNumber(value)
    if (typeof value === 'string') return { stringValue: value }
    if (value instanceof Date) return { timestampValue: value.toISOString() }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } }
}

export function encodeFields(record: Record<string, unknown>): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {}
    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === deleteField) continue
        Object.defineProperty(fields, key, {
            value: encodeValue(value),
            enumerable: true,
            writable: true,
            configurable: true,
        })
    }
    return fields
}

export interface DecodeOptions {
    unsafeIntegers?: 'throw' | 'bigint'
}

export function decodeValue(value: FirestoreValue, options: DecodeOptions = {}): unknown {
    if ('nullValue' in value) return null
    if ('booleanValue' in value) return value.booleanValue
    if ('integerValue' in value) {
        const integer = Number(value.integerValue)
        if (!Number.isSafeInteger(integer)) {
            if (options.unsafeIntegers === 'bigint') return BigInt(value.integerValue)
            throw new Error(`Firestore integerValue ${value.integerValue} exceeds the safe integer range`)
        }
        return integer
    }
    if ('doubleValue' in value) return Number(value.doubleValue)
    if ('stringValue' in value) return value.stringValue
    if ('timestampValue' in value) return value.timestampValue
    if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(item => decodeValue(item, options))
    if ('mapValue' in value) return decodeFields(value.mapValue.fields, options)
    return Object.values(value)[0]
}

export function decodeFields(
    fields: Record<string, FirestoreValue> | undefined,
    options: DecodeOptions = {},
): Record<string, unknown> {
    const record: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields ?? {})) {
        Object.defineProperty(record, key, {
            value: decodeValue(value, options),
            enumerable: true,
            writable: true,
            configurable: true,
        })
    }
    return record
}

export function decodeDocument(
    document: FirestoreDocument,
    options: DecodeOptions = {},
): Record<string, unknown> {
    const id = document.name.slice(document.name.lastIndexOf('/') + 1)
    return { ...decodeFields(document.fields, options), id }
}
