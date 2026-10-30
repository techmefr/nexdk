import { describe, expect, it } from 'vitest'
import { encodeId, splitId, toQuery } from '../src/query.ts'

describe('encodeId', () => {
    it('encodes a value as a single path segment', () => {
        expect(encodeId('a/b c')).toBe('a%2Fb%20c')
        expect(encodeId(7)).toBe('7')
    })

    it('rejects empty and dot-segment ids', () => {
        for (const id of ['', '.', '..']) expect(() => encodeId(id)).toThrow('Invalid id')
        expect(() => encodeId(undefined as unknown as string)).toThrow('Invalid id')
    })
})

describe('toQuery', () => {
    it('returns an empty string for undefined/null', () => {
        expect(toQuery(undefined)).toBe('')
        expect(toQuery(null)).toBe('')
    })

    it('serializes a flat object', () => {
        expect(toQuery({ name: 'Alice', age: 30 })).toBe('?name=Alice&age=30')
    })

    it('drops undefined/null values', () => {
        expect(toQuery({ name: 'Alice', age: undefined, city: null })).toBe('?name=Alice')
    })

    it('returns an empty string for an empty object', () => {
        expect(toQuery({})).toBe('')
    })
})

describe('splitId', () => {
    it('separates id from the rest of the payload', () => {
        expect(splitId({ id: '1', name: 'Alice' })).toEqual({ id: '1', body: { name: 'Alice' } })
    })

    it('defaults to an empty body when given only an id', () => {
        expect(splitId({ id: 42 })).toEqual({ id: 42, body: {} })
    })
})
