import { describe, expect, it, vi } from 'vitest'
import { NhostDriver } from '../src/nhost-driver.ts'

const endpoint = 'http://localhost:1337/v1/graphql'

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

function ok() {
    return new Response(JSON.stringify({ data: { users: [] } }), { headers: { 'Content-Type': 'application/json' } })
}

describe('nhost per-call options and onResponse', () => {
    it('sends the call headers and signal with the GraphQL request', async () => {
        const fetch = vi.fn(async () => ok())
        const driver = new NhostDriver({ endpoint, fetch, headers: { Authorization: 'Bearer driver' } }) as unknown as { query: Call }
        const controller = new AbortController()
        await driver.query('users', {}, undefined, { headers: { authorization: 'Bearer call' }, signal: controller.signal, fragment: 'id' })
        const init = fetch.mock.calls[0][1] as RequestInit
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer call')
        expect(init.signal).toBe(controller.signal)
        expect(JSON.parse(init.body as string).query).toContain('{ id }')
    })

    it('times out a single call', async () => {
        const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
        )
        const driver = new NhostDriver({ endpoint, fetch }) as unknown as { deleteById: Call }
        await expect(driver.deleteById('users', { id: '1' }, undefined, { timeout: 5 })).rejects.toMatchObject({ name: 'TimeoutError' })
    })
})
