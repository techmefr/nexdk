import { SdkError } from 'nexdk'
import { HttpError } from '@nexdk/http'
import { describe, expect, it, vi } from 'vitest'
import { LomkitDriver } from '../src/driver.ts'
import { fieldErrors, fieldName } from '../src/errors.ts'

describe('fieldName', () => {
    it('strips the mutate operation index and the attributes segment', () => {
        expect(fieldName('mutate.0.attributes.email')).toBe('email')
        expect(fieldName('mutate.12.attributes.address.city')).toBe('address.city')
    })

    it('flattens nested relation paths', () => {
        expect(fieldName('mutate.0.relations.posts.1.attributes.title')).toBe('posts.1.title')
        expect(fieldName('mutate.0.relations.manager.attributes.name')).toBe('manager.name')
        expect(fieldName('mutate.0.relations.posts.0.relations.tags.2.key')).toBe('posts.0.tags.2.key')
    })

    it('keeps the operation level keys', () => {
        expect(fieldName('mutate.0.key')).toBe('key')
        expect(fieldName('mutate.0.operation')).toBe('operation')
    })

    it('strips the search prefix and keeps the rest of the path', () => {
        expect(fieldName('search.limit')).toBe('limit')
        expect(fieldName('search.filters.0.field')).toBe('filters.0.field')
    })

    it('leaves other keys alone', () => {
        expect(fieldName('email')).toBe('email')
        expect(fieldName('resources.0')).toBe('resources.0')
        expect(fieldName('fields.role')).toBe('fields.role')
        expect(fieldName('searching.limit')).toBe('searching.limit')
    })
})

describe('fieldErrors', () => {
    it('merges the messages of keys that become the same name', () => {
        expect(
            fieldErrors({ 'mutate.0.attributes.email': ['a'], 'mutate.1.attributes.email': ['b'], 'mutate.1.attributes.name': ['c'] }),
        ).toEqual({ email: ['a', 'b'], name: ['c'] })
    })

    it('returns anything that is not a field map as is', () => {
        expect(fieldErrors(undefined)).toBeUndefined()
        expect(fieldErrors(null)).toBeNull()
        expect(fieldErrors('boom')).toBe('boom')
        const list = ['a']
        expect(fieldErrors(list)).toBe(list)
    })
})

function open(status: number, body: unknown) {
    const injected = vi.fn().mockImplementation(
        async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    )
    return new LomkitDriver({ baseUrl: 'http://localhost:8000/api', fetch: injected as unknown as typeof fetch })
}

const body = {
    message: 'The mutate.0.attributes.name field is required. (and 1 more error)',
    errors: { 'mutate.0.attributes.name': ['required'], 'mutate.0.attributes.email': ['invalid'] },
}

describe('lomkit 422 field names', () => {
    it('gives simple names on the thrown error and the error event and keeps the raw body in data', async () => {
        const driver = open(422, body)
        const events: Array<[string, any]> = []
        const error = (await driver.mutate('users', { operation: 'create', attributes: {} }, (event, data) => events.push([event, data])).catch(e => e)) as HttpError

        expect(error).toBeInstanceOf(HttpError)
        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(422)
        expect(error.message).toBe(body.message)
        expect(error.errors).toEqual({ name: ['required'], email: ['invalid'] })
        expect(error.data).toEqual(body)
        const emitted = events.filter(([event]) => event === 'error')
        expect(emitted).toEqual([
            ['error', { message: body.message, status: 422, errors: { name: ['required'], email: ['invalid'] }, kind: 'http' }],
        ])
    })

    it('does the same for a search failure', async () => {
        const driver = open(422, { message: 'The selected search.limit is invalid.', errors: { 'search.limit': ['The selected search.limit is invalid.'] } })
        const error = (await driver.get('users', { search: { limit: 7 } }).catch(e => e)) as SdkError
        expect(error.errors).toEqual({ limit: ['The selected search.limit is invalid.'] })
    })

    it('leaves other statuses and non field bodies untouched', async () => {
        const forbidden = (await open(403, { message: 'Forbidden' }).get('users', {}).catch(e => e)) as SdkError
        expect(forbidden.status).toBe(403)
        expect(forbidden.errors).toBeUndefined()
        const plain = (await open(422, { message: 'Nope' }).get('users', {}).catch(e => e)) as SdkError
        expect(plain.status).toBe(422)
        expect(plain.data).toEqual({ message: 'Nope' })
    })
})
