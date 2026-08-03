import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver, SupabaseQueryError } from '../src/driver.ts'

// Mutated per test to make `select`/`eq` resolve as a Postgrest error.
let nextError: { message: string; code?: string } | null = null

vi.mock('@supabase/supabase-js', () => {
    const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
    }

    const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnValue({ data: [], error: nextError }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ data: [], error: nextError }),
    }))

    return {
        createClient: vi.fn(() => ({
            from: mockFrom,
            channel: vi.fn(() => mockChannel),
            removeChannel: vi.fn(),
        })),
    }
})

function makeDriver() {
    return new SupabaseDriver({ url: 'http://localhost:54321', key: 'anon-key' })
}

describe('SupabaseDriver', () => {
    it('instantiates without throwing', () => {
        expect(() => makeDriver()).not.toThrow()
    })

    it('get throws a SupabaseQueryError and emits error, on Postgrest error', async () => {
        nextError = { message: 'relation "messages" does not exist', code: '42P01' }
        const driver = makeDriver()
        const onEvent = vi.fn()

        await expect(driver.get('messages', {}, onEvent)).rejects.toThrow(SupabaseQueryError)
        expect(onEvent).toHaveBeenCalledWith('error', nextError)
        expect(onEvent).not.toHaveBeenCalledWith('success', expect.anything())

        nextError = null
    })

    it('remove throws on Postgrest error instead of resolving', async () => {
        nextError = { message: 'permission denied' }
        const driver = makeDriver()

        await expect(driver.remove('messages', { id: '1' })).rejects.toThrow('permission denied')

        nextError = null
    })

    it('bindResource stores the resource', () => {
        const driver = makeDriver()
        const fakeResource = { name: 'messages', schema: {} as never, fragments: {}, relations: {} }
        expect(() => driver.bindResource('messages', fakeResource)).not.toThrow()
    })

    it('subscribe returns a cleanup function', () => {
        const driver = makeDriver()
        const unsub = driver.subscribe('messages', { room_id: 'room-1' })
        expect(typeof unsub).toBe('function')
        expect(() => unsub()).not.toThrow()
    })
})
