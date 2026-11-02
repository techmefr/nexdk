import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SdkError } from 'nexdk'
import { HttpError, createRequest, request } from '../src/request.ts'

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
})

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('request', () => {
    it('returns the parsed JSON body on a 2xx response', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 1, name: 'Alice' }))

        const result = await request<{ id: number; name: string }>('http://api.test/users/1')

        expect(result).toEqual({ id: 1, name: 'Alice' })
    })

    it('forwards method, headers and body to fetch', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }))

        await request('http://api.test/users', {
            method: 'POST',
            headers: { Authorization: 'Bearer token' },
            body: { name: 'Alice' },
        })

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('http://api.test/users')
        expect(init.method).toBe('POST')
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token')
        expect(init.body).toBe(JSON.stringify({ name: 'Alice' }))
    })

    it('throws an HttpError carrying status and parsed body on a non-2xx response', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(422, { message: 'Validation failed' }))

        const error = await request('http://api.test/users').catch(e => e as HttpError)

        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(422)
        expect(error.data).toEqual({ message: 'Validation failed' })
    })

    it('defaults the message to "HTTP <status>"', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(500, {}))

        await expect(request('http://api.test/users')).rejects.toThrow('HTTP 500')
    })

    it('wraps a network failure (no response at all) into an HttpError with status 0', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

        const error = await request('http://api.test/users').catch(e => e as HttpError)

        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(0)
    })
})

describe('request with an injected fetch', () => {
    it('uses the injected fetch instead of the global one', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(200, { ok: true }))

        const result = await request('http://api.test/users', { fetch: injected as unknown as typeof fetch })

        expect(result).toEqual({ ok: true })
        expect(injected).toHaveBeenCalledTimes(1)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('forwards method, headers and body to the injected fetch', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(200, {}))

        await request('http://api.test/users', {
            method: 'POST',
            headers: { 'X-Test': '1' },
            body: { a: 1 },
            fetch: injected as unknown as typeof fetch,
        })

        const [url, init] = injected.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('http://api.test/users')
        expect(init.method).toBe('POST')
        expect(new Headers(init.headers).get('X-Test')).toBe('1')
        expect(init.body).toBe(JSON.stringify({ a: 1 }))
    })

    it('throws an HttpError when the injected fetch answers an error status', async () => {
        const injected = vi.fn().mockResolvedValueOnce(jsonResponse(404, { message: 'nope' }))

        const error = await request('http://api.test/x', { fetch: injected as unknown as typeof fetch }).catch(
            e => e as HttpError,
        )

        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(404)
    })

    it('createRequest binds the fetch to every call', async () => {
        const injected = vi.fn().mockImplementation(async () => jsonResponse(200, { n: 1 }))
        const bound = createRequest(injected as unknown as typeof fetch)

        await bound('http://api.test/a')
        await bound('http://api.test/b', { method: 'DELETE' })

        expect(injected).toHaveBeenCalledTimes(2)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('createRequest without a fetch falls back to the global one', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(200, { n: 1 }))

        await createRequest()('http://api.test/a')

        expect(mockFetch).toHaveBeenCalledTimes(1)
    })
})

describe('HttpError details', () => {
    it('is an SdkError carrying status, data and Laravel field errors', async () => {
        mockFetch.mockResolvedValueOnce(
            jsonResponse(422, { message: 'The email field is required.', errors: { email: ['required'] } }),
        )

        const error = await request('http://api.test/users').catch(e => e as HttpError)

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(422)
        expect(error.message).toBe('The email field is required.')
        expect(error.errors).toEqual({ email: ['required'] })
        expect(error.data).toEqual({ message: 'The email field is required.', errors: { email: ['required'] } })
    })

    it('leaves errors undefined when the body has none', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(500, 'oops'))

        const error = await request('http://api.test/users').catch(e => e as HttpError)

        expect(error.errors).toBeUndefined()
        expect(error.message).toBe('HTTP 500')
    })
})
