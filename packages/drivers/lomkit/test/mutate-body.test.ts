import { describe, expect, it, vi } from 'vitest'
import { LomkitDriver } from '../src/driver.ts'

type Call = (resource: string, payload?: unknown) => Promise<unknown>

function makeDriver(injected: unknown) {
    return new LomkitDriver({ baseUrl: 'http://localhost:8000/api', fetch: injected as typeof fetch }) as unknown as {
        get: Call
        mutate: Call
    }
}

function bodyOf(injected: ReturnType<typeof vi.fn>): unknown {
    return JSON.parse(String((injected.mock.calls[0][1] as RequestInit).body))
}

const ok = () =>
    vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ created: [1], updated: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

describe('lomkit mutate body', () => {
    it('wraps a single payload in a one element list', async () => {
        const injected = ok()

        await makeDriver(injected).mutate('users', { operation: 'create', attributes: { name: 'a' } })

        expect(bodyOf(injected)).toEqual({ mutate: [{ operation: 'create', attributes: { name: 'a' } }] })
    })

    it('sends an array payload as the mutate list', async () => {
        const injected = ok()
        const payload = [{ operation: 'create', attributes: { name: 'a' } }, { operation: 'create', attributes: { name: 'b' } }]

        await makeDriver(injected).mutate('users', payload)

        expect(bodyOf(injected)).toEqual({ mutate: payload })
    })

    it('returns the created and updated keys as sent by the server', async () => {
        expect(await makeDriver(ok()).mutate('users', {})).toEqual({ created: [1], updated: [] })
    })
})

describe('lomkit resource name guard', () => {
    it.each(['', '.', '..'])('refuses the resource name "%s"', async name => {
        const injected = vi.fn()

        await expect(makeDriver(injected).get(name)).rejects.toThrow('Invalid resource name')
        expect(injected).not.toHaveBeenCalled()
    })
})
