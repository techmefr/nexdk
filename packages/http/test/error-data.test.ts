import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, createRequest, request } from '../src/request.ts'
import { encodeResource, toQuery } from '../src/query.ts'

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('HttpError message', () => {
    it('joins a Nest message array', () => {
        const error = new HttpError(400, { message: ['a must be a string', 'b is required'], error: 'Bad Request' })

        expect(error.message).toBe('a must be a string, b is required')
        expect(error.errors).toBeUndefined()
    })

    it('uses the API Platform detail', () => {
        expect(new HttpError(404, { title: 'An error occurred', detail: 'Not Found' }).message).toBe('Not Found')
    })

    it('uses the Firestore error message', () => {
        expect(new HttpError(404, { error: { code: 404, message: 'Document not found', status: 'NOT_FOUND' } }).message).toBe(
            'Document not found',
        )
    })

    it('uses the Strapi error message and falls back to its details', () => {
        expect(new HttpError(400, { error: { message: 'name must be defined' } }).message).toBe('name must be defined')
        expect(new HttpError(400, { error: { message: '', details: 'bad filter' } }).message).toBe('bad filter')
    })

    it('uses a string error and the title as last resorts', () => {
        expect(new HttpError(400, { error: 'invalid_grant' }).message).toBe('invalid_grant')
        expect(new HttpError(400, { title: 'Oops' }).message).toBe('Oops')
    })

    it('keeps HTTP status for bodies without a usable message', () => {
        expect(new HttpError(502, 'gateway down').message).toBe('HTTP 502')
        expect(new HttpError(500, { message: [] }).message).toBe('HTTP 500')
    })
})

describe('HttpError errors', () => {
    it('groups API Platform violations by property path', () => {
        const error = new HttpError(422, {
            violations: [
                { propertyPath: 'name', message: 'blank' },
                { propertyPath: 'name', message: 'short' },
                { propertyPath: '', message: 'global' },
            ],
        })

        expect(error.errors).toEqual({ name: ['blank', 'short'], _: ['global'] })
    })

    it('maps Strapi validation details to dotted paths', () => {
        const error = new HttpError(400, {
            error: {
                message: 'x',
                details: { errors: [{ path: ['name'], message: 'required' }, { path: ['a', 'b'], message: 'bad' }] },
            },
        })

        expect(error.errors).toEqual({ name: ['required'], 'a.b': ['bad'] })
    })

    it('wraps string field errors in arrays and leaves other shapes alone', () => {
        expect(new HttpError(422, { errors: { email: 'required' } }).errors).toEqual({ email: ['required'] })
        expect(new HttpError(422, { errors: [{ message: 'x' }] }).errors).toEqual([{ message: 'x' }])
    })

    it('keeps the raw body in data', () => {
        const data = { violations: [{ propertyPath: 'a', message: 'm' }] }

        expect(new HttpError(422, data).data).toBe(data)
    })
})

describe('toQuery space encoding', () => {
    it('encodes a space as %20 and keeps a literal plus as %2B', () => {
        expect(toQuery({ orderBy: 'n desc', q: 'a+b' })).toBe('?orderBy=n%20desc&q=a%2Bb')
    })
})

describe('encodeResource', () => {
    it('encodes a name and refuses empty, dot and double dot', () => {
        expect(encodeResource('a b/c')).toBe('a%20b%2Fc')
        for (const name of ['', '.', '..']) expect(() => encodeResource(name)).toThrow(`Invalid resource name: "${name}"`)
    })
})

describe('timeout and signal', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('aborts a request that exceeds the timeout with a status 0 error', async () => {
        const slow = vi.fn((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
            }),
        )

        const error = await request('http://api.test/slow', { fetch: slow as unknown as typeof fetch, timeout: 20 }).catch(
            e => e as HttpError,
        )

        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(0)
    })

    it('aborts a request through the caller signal', async () => {
        const controller = new AbortController()
        const slow = vi.fn((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
            }),
        )
        const pending = request('http://api.test/slow', { fetch: slow as unknown as typeof fetch, signal: controller.signal })
        controller.abort()

        const error = await pending.catch(e => e as HttpError)

        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(0)
    })

    it('createRequest applies its options to every call and still returns the body', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
        const controller = new AbortController()
        const bound = createRequest(injected as unknown as typeof fetch, { timeout: 1000, signal: controller.signal })

        expect(await bound('http://api.test/a')).toEqual({ ok: true })
        expect((injected.mock.calls[0][1] as RequestInit).signal).toBeDefined()
    })
})

describe('HttpError Nest validation errors', () => {
    const nest = (message: unknown, error = 'Bad Request') => new HttpError(400, { statusCode: 400, message, error })

    it('keys class-validator messages by their property', () => {
        expect(nest(['email must be an email', 'name should not be empty', 'age must not be less than 18']).errors).toEqual({
            email: ['email must be an email'],
            name: ['name should not be empty'],
            age: ['age must not be less than 18'],
        })
    })

    it('groups several messages of one property', () => {
        expect(nest(['password must be longer than or equal to 8 characters', 'password must contain a digit']).errors).toEqual({
            password: ['password must be longer than or equal to 8 characters', 'password must contain a digit'],
        })
    })

    it('handles nested paths, each-value and whitelist messages', () => {
        expect(
            nest(['address.city must be a string', 'each value in tags must be a string', 'property admin should not exist']).errors,
        ).toEqual({
            'address.city': ['address.city must be a string'],
            tags: ['each value in tags must be a string'],
            admin: ['property admin should not exist'],
        })
    })

    it('puts free text messages under _', () => {
        expect(nest(['Email already used', 'name must be a string']).errors).toEqual({
            _: ['Email already used'],
            name: ['name must be a string'],
        })
    })

    it('leaves errors undefined for a plain Nest error', () => {
        expect(nest('Not Found', 'Not Found').errors).toBeUndefined()
        expect(nest([]).errors).toBeUndefined()
        expect(new HttpError(400, { message: ['a must be b'], error: 'Bad Request' }).errors).toBeUndefined()
    })

    it('keeps the message list in data and the joined message', () => {
        const error = nest(['a must be b', 'c must be d'])

        expect(error.message).toBe('a must be b, c must be d')
        expect(error.data).toEqual({ statusCode: 400, message: ['a must be b', 'c must be d'], error: 'Bad Request' })
    })
})
