import { createSdk } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver } from '../src/driver.ts'

vi.mock('@supabase/supabase-js', () => {
    const channel = { on: () => channel, subscribe: () => channel }
    return { createClient: () => ({ channel: () => channel, removeChannel: () => undefined }) }
})

describe('supabase subscribe through createSdk', () => {
    it('throws synchronously on an invalid room_id instead of returning a Promise', () => {
        const sdk = createSdk({ drivers: { supabase: new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' }) } }) as unknown as {
            supabase: Record<string, Record<string, (payload?: unknown) => unknown>>
        }
        expect(() => sdk.supabase.messages.subscribe({ room_id: 'a b' })).toThrow('Invalid room_id')
        expect(typeof sdk.supabase.messages.subscribe({ room_id: 'a-b' })).toBe('function')
    })
})
