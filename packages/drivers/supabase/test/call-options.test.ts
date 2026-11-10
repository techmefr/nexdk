import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver } from '../src/driver.ts'

const applied: Array<[string, unknown, unknown?]> = []

vi.mock('@supabase/supabase-js', () => {
    const builder: Record<string, unknown> = {}
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'is']) builder[name] = () => builder
    builder.abortSignal = (signal: AbortSignal) => {
        applied.push(['signal', signal])
        return builder
    }
    builder.setHeader = (name: string, value: string) => {
        applied.push(['header', name, value])
        return builder
    }
    builder.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null, status: 200 })
    return { createClient: () => ({ from: () => builder }) }
})

type Call = (resource: string, payload?: unknown, onEvent?: unknown, options?: unknown) => Promise<unknown>

describe('supabase per-call options', () => {
    it.each(['get', 'insert', 'update', 'remove'])('%s applies the call signal and headers to the query', async method => {
        applied.length = 0
        const driver = new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' }) as unknown as Record<string, Call>
        const controller = new AbortController()
        await driver[method]('messages', { id: 1 }, undefined, { signal: controller.signal, headers: { 'x-trace': '7' } })
        expect(applied).toEqual([['signal', controller.signal], ['header', 'x-trace', '7']])
    })

    it('combines the call signal with a timeout', async () => {
        applied.length = 0
        const driver = new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' }) as unknown as Record<string, Call>
        const controller = new AbortController()
        await driver.get('messages', {}, undefined, { signal: controller.signal, timeout: 1000 })
        const signal = applied[0][1] as AbortSignal
        expect(signal).not.toBe(controller.signal)
        controller.abort()
        expect(signal.aborted).toBe(true)
    })

    it('touches nothing without options', async () => {
        applied.length = 0
        const driver = new SupabaseDriver({ url: 'http://localhost:54321', key: 'k' }) as unknown as Record<string, Call>
        await driver.get('messages', {})
        expect(applied).toEqual([])
    })
})
