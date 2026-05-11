import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver } from '../src/driver.ts'

vi.mock('@supabase/supabase-js', () => {
    const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
    }

    const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ data: [], error: null }),
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
