import { SdkError } from 'nexdk'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver, SupabaseQueryError } from '../src/driver.ts'

let nextResult: { data: unknown; error: unknown; status?: number } = { data: [], error: null }

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => nextResult),
        })),
    })),
}))

describe('supabase injected fetch', () => {
    it('forwards the fetch to the supabase client as global.fetch', () => {
        const injected = vi.fn() as unknown as typeof fetch

        new SupabaseDriver({ url: 'http://localhost:54321', key: 'k', fetch: injected })

        expect(createClient).toHaveBeenLastCalledWith('http://localhost:54321', 'k', { global: { fetch: injected } })
    })

    it('passes no options when no fetch is given', () => {
        new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' })

        expect(createClient).toHaveBeenLastCalledWith('http://localhost:54321', 'k', undefined)
    })
})

describe('supabase typed errors', () => {
    it('throws a SupabaseQueryError that is an SdkError with status and errors, and emits them', async () => {
        nextResult = {
            data: null,
            error: { message: 'permission denied', code: '42501', details: 'rls', hint: 'check policy' },
            status: 403,
        }
        const driver = new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' })
        const events: Array<[string, unknown]> = []

        const error = (await driver
            .get('messages', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SupabaseQueryError

        expect(error).toBeInstanceOf(SdkError)
        expect(error).toBeInstanceOf(SupabaseQueryError)
        expect(error.status).toBe(403)
        expect(error.errors).toEqual({ code: '42501', details: 'rls', hint: 'check policy' })
        expect(error.code).toBe('42501')
        expect(events.filter(([event]) => event === 'error')).toEqual([
            [
                'error',
                {
                    message: 'permission denied',
                    code: '42501',
                    details: 'rls',
                    hint: 'check policy',
                    status: 403,
                    errors: { code: '42501', details: 'rls', hint: 'check policy' },
                    resource: 'messages',
                    method: 'get',
                },
            ],
        ])
    })
})
