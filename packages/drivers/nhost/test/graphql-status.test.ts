import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { NhostDriver } from '../src/nhost-driver.ts'

const endpoint = 'http://localhost:1337/v1/graphql'

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

function answering(code: string | undefined) {
    const extensions = code === undefined ? undefined : { code, path: '$' }
    return vi.fn(async () => new Response(JSON.stringify({ data: null, errors: [{ message: 'failed', extensions }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }))
}

async function failure(fetch: ReturnType<typeof vi.fn>, options?: unknown): Promise<SdkError> {
    const driver = new NhostDriver({ endpoint, fetch: fetch as unknown as typeof globalThis.fetch }) as unknown as { query: Call }
    return (await driver.query('users', {}, undefined, options).catch(error => error)) as SdkError
}

describe('nhost GraphQL error status', () => {
    it.each([
        ['access-denied', 403],
        ['permission-error', 403],
        ['invalid-jwt', 401],
        ['validation-failed', 400],
        ['parse-failed', 400],
        ['not-found', 404],
        ['constraint-violation', 409],
        ['unexpected', 500],
        [undefined, 500],
    ])('maps the code %s to the status %i with the kind http', async (code, status) => {
        const error = await failure(answering(code))
        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(status)
        expect(error.kind).toBe('http')
        expect(error.message).toBe('failed')
    })

    it('uses the first error with a known code', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({
            data: null,
            errors: [{ message: 'a', extensions: { code: 'odd' } }, { message: 'b', extensions: { code: 'access-denied' } }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        expect((await failure(fetch)).status).toBe(403)
    })
})

describe('nhost transport failures', () => {
    it('turns a network failure into an SdkError of status 0 and kind network', async () => {
        const cause = new TypeError('fetch failed')
        const error = await failure(vi.fn(async () => { throw cause }))
        expect(error).toMatchObject({ name: 'SdkError', status: 0, kind: 'network', message: 'fetch failed' })
        expect(error.cause).toBe(cause)
    })

    it('tells an abort from a timeout', async () => {
        const hanging = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                if (init?.signal?.aborted) reject(init.signal.reason)
                init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            }),
        )
        const controller = new AbortController()
        const pending = failure(hanging, { signal: controller.signal })
        controller.abort()
        expect(await pending).toMatchObject({ status: 0, kind: 'abort' })
        expect(await failure(hanging, { timeout: 5 })).toMatchObject({ status: 0, kind: 'timeout' })
    })
})
