import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, request } from '../src/request.ts'

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
