import { describe, expect, it, vi } from 'vitest'
import { createPilotaHooks, resolveEventHandler } from '../src/index.ts'

describe('createPilotaHooks', () => {
    it('creates a hooks instance with callHook and hook methods', () => {
        const hooks = createPilotaHooks()
        expect(typeof hooks.hook).toBe('function')
        expect(typeof hooks.callHook).toBe('function')
    })

    it('fires registered global hooks on callHook', async () => {
        const hooks = createPilotaHooks()
        const received: unknown[] = []

        hooks.hook('success', data => received.push(data))
        await hooks.callHook('success', { result: 'ok' })

        expect(received).toEqual([{ result: 'ok' }])
    })

    it('can register multiple listeners for the same event', async () => {
        const hooks = createPilotaHooks()
        let count = 0

        hooks.hook('error', () => count++)
        hooks.hook('error', () => count++)
        await hooks.callHook('error', {})

        expect(count).toBe(2)
    })
})

describe('resolveEventHandler — local priority', () => {
    it('returns the local handler directly when provided', () => {
        const hooks = createPilotaHooks()
        const local = vi.fn()

        const handler = resolveEventHandler(local, hooks)
        expect(handler).toBe(local)
    })

    it('calls global hooks when no local handler is provided', async () => {
        const hooks = createPilotaHooks()
        const globalSpy = vi.fn()

        hooks.hook('request', globalSpy)
        const handler = resolveEventHandler(undefined, hooks)
        handler('request', { payload: 1 })

        await new Promise(r => setTimeout(r, 10))
        expect(globalSpy).toHaveBeenCalledWith({ payload: 1 })
    })

    it('does NOT call global hooks when a local handler is provided', async () => {
        const hooks = createPilotaHooks()
        const globalSpy = vi.fn()
        const local = vi.fn()

        hooks.hook('request', globalSpy)
        const handler = resolveEventHandler(local, hooks)
        handler('request', {})

        await new Promise(r => setTimeout(r, 10))
        expect(local).toHaveBeenCalled()
        expect(globalSpy).not.toHaveBeenCalled()
    })
})
