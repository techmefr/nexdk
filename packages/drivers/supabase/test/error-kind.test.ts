import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver, SupabaseQueryError } from '../src/driver.ts'

let answer: { data: unknown; error: unknown; status: number } | 'hang' = 'hang'

vi.mock('@supabase/supabase-js', () => {
    const builder: Record<string, unknown> = {}
    let signal: AbortSignal | undefined
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'is']) builder[name] = () => builder
    builder.setHeader = () => builder
    builder.abortSignal = (next: AbortSignal) => {
        signal = next
        return builder
    }
    builder.then = (resolve: (value: unknown) => void) => {
        if (answer !== 'hang') return resolve(answer)
        const aborted = () => resolve({ data: null, error: { message: 'AbortError: aborted', code: '' }, status: 0 })
        if (signal?.aborted) return aborted()
        signal?.addEventListener('abort', aborted)
    }
    return { createClient: () => ({ from: () => builder }) }
})

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

const driver = () => new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' }) as unknown as Record<string, Call>

async function failure(options?: unknown): Promise<SupabaseQueryError> {
    return (await driver().get('messages', {}, undefined, options).catch(error => error)) as SupabaseQueryError
}

describe('supabase error kind', () => {
    it('is timeout when the call timeout elapses', async () => {
        answer = 'hang'
        expect(await failure({ timeout: 5 })).toMatchObject({ status: 0, kind: 'timeout' })
    })

    it('is abort when the call signal aborts', async () => {
        answer = 'hang'
        const controller = new AbortController()
        const pending = failure({ signal: controller.signal })
        controller.abort()
        expect(await pending).toMatchObject({ status: 0, kind: 'abort' })
    })

    it('is network for a status 0 answer without abort, http for an error status', async () => {
        answer = { data: null, error: { message: 'FetchError: fetch failed', code: '' }, status: 0 }
        expect((await failure()).kind).toBe('network')
        answer = { data: null, error: { message: 'denied', code: '42501' }, status: 403 }
        expect(await failure()).toMatchObject({ status: 403, kind: 'http' })
    })
})
