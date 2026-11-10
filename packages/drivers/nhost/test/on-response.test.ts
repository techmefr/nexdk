import { describe, expect, it } from 'vitest'
import { NhostDriver } from '../src/nhost-driver.ts'

const endpoint = 'http://localhost:1337/v1/graphql'

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

function ok() {
    return new Response(JSON.stringify({ data: { users: [] } }), { headers: { 'Content-Type': 'application/json' } })
}

describe('nhost onResponse', () => {
    it('calls onResponse and turns its exception into the error of the call', async () => {
        const seen: string[] = []
        const failure = new Error('refresh failed')
        const driver = new NhostDriver({
            endpoint,
            fetch: async () => ok(),
            onResponse: (response, request) => {
                seen.push(`${request.method} ${request.url} ${response.status}`)
                throw failure
            },
        }) as unknown as { query: Call }
        await expect(driver.query('users', {})).rejects.toBe(failure)
        expect(seen).toEqual([`POST ${endpoint} 200`])
    })
})
