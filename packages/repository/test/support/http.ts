import type { FetchLike } from 'nexdk'

export interface Call {
    method: string
    url: URL
    body: any
}

export type Handler = (call: Call) => Response

export interface FakeBackend {
    fetch: FetchLike
    calls: Call[]
}

export function json(status: number, value: unknown): Response {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

export function empty(): Response {
    return new Response(null, { status: 204 })
}

export function backend(handler: Handler): FakeBackend {
    const calls: Call[] = []
    const fetch: FetchLike = async (input, init) => {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
        const call = { method: init?.method ?? 'GET', url: new URL(String(input)), body }
        calls.push(call)
        return handler(call)
    }
    return { fetch, calls }
}

export function intParam(url: URL, name: string, fallback: number): number {
    const value = url.searchParams.get(name)
    return value === null ? fallback : Number(value)
}

export function lastSegment(url: URL): string {
    return decodeURIComponent(url.pathname.split('/').pop() ?? '')
}
