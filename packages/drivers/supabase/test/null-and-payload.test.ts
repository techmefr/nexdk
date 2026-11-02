import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver } from '../src/driver.ts'

const calls: Array<[string, ...unknown[]]> = []

function builder() {
    const chain: Record<string, unknown> = {}
    const record = (name: string) => (...args: unknown[]) => {
        calls.push([name, ...args])
        return chain
    }
    for (const name of ['select', 'eq', 'is', 'update', 'delete']) chain[name] = record(name)
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null, status: 200 })
    return chain
}

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: vi.fn(() => builder()) })),
}))

const driver = new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' })

describe('supabase null filter', () => {
    it('sends is.null for a null value and eq for the others', async () => {
        calls.length = 0

        await driver.get('users', { age: null, name: 'Erin' })

        expect(calls).toContainEqual(['is', 'age', null])
        expect(calls).toContainEqual(['eq', 'name', 'Erin'])
        expect(calls.some(call => call[0] === 'eq' && call[1] === 'age')).toBe(false)
    })
})

describe('supabase missing payload', () => {
    it.each(['update', 'remove'] as const)('%s without a payload throws an SdkError and emits error', async method => {
        const events: Array<[string, unknown]> = []

        const error = await driver[method]('users', undefined, (event, data) => events.push([event, data])).catch(e => e)

        expect(error).toBeInstanceOf(SdkError)
        expect(error).not.toBeInstanceOf(TypeError)
        expect(events.at(-1)?.[0]).toBe('error')
    })
})
