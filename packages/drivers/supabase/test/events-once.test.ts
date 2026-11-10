import { createSdk } from 'nexdk'
import type { SdkEvent } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriver } from '../src/driver.ts'

const answer: { error: { message: string; code?: string } | null; status: number } = { error: null, status: 200 }

vi.mock('@supabase/supabase-js', () => {
    const builder: Record<string, unknown> = {}
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'is']) builder[name] = () => builder
    builder.then = (resolve: (value: unknown) => void) => resolve({ data: [], ...answer })
    return { createClient: () => ({ from: () => builder }) }
})

type Method = (payload?: unknown, onEvent?: (event: SdkEvent, data?: unknown) => void) => Promise<unknown>

const calls: Array<[string, unknown]> = [
    ['get', { room_id: 1 }],
    ['insert', { body: 'hi' }],
    ['update', { id: 1, body: 'hi' }],
    ['remove', { id: 1 }],
]

function run(method: string) {
    const global: Array<[SdkEvent, unknown]> = []
    const local: SdkEvent[] = []
    const sdk = createSdk({
        drivers: { supabase: new SupabaseDriver({ url: 'http://localhost:54321', key: 'anon' }) },
        notify: (event, data) => global.push([event, data]),
    }) as unknown as Record<string, Record<string, Record<string, Method>>>
    const call = (payload: unknown) => sdk.supabase.messages[method](payload, event => local.push(event)).catch(() => undefined)
    return { global, local, call }
}

describe.each(calls)('supabase %s', (method, payload) => {
    it('emits one request with the resource and the payload, then one success', async () => {
        answer.error = null
        const { global, local, call } = run(method)
        await call(payload)
        expect(global.map(([event]) => event)).toEqual(['request', 'success'])
        expect(global[0][1]).toEqual({ resource: 'messages', method, payload })
        expect(local).toEqual(['request', 'success'])
    })

    it('emits one request then one error carrying the Postgrest fields', async () => {
        answer.error = { message: 'denied', code: '42501' }
        answer.status = 403
        const { global, local, call } = run(method)
        await call(payload)
        expect(global.map(([event]) => event)).toEqual(['request', 'error'])
        expect(global[1][1]).toMatchObject({ message: 'denied', code: '42501', status: 403, errors: { code: '42501' } })
        expect(local).toEqual(['request', 'error'])
        answer.error = null
        answer.status = 200
    })
})

describe('supabase guard errors', () => {
    it.each(['update', 'remove'])('%s without a payload emits one request and one error', async method => {
        const { global, call } = run(method)
        await call(undefined)
        expect(global.map(([event]) => event)).toEqual(['request', 'error'])
    })
})
