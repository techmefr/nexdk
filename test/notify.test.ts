import { describe, expect, it, vi } from 'vitest'
import { createNotify } from '../src/notify.ts'

describe('createNotify', () => {
    it('dispatches request, success, error and data events to the matching handlers', () => {
        const onRequest = vi.fn()
        const onSuccess = vi.fn()
        const onError = vi.fn()
        const onData = vi.fn()

        const notify = createNotify({ onRequest, onSuccess, onError, onData })

        notify('request', { resource: 'users', payload: {} })
        notify('success', { ok: true })
        notify('error', { message: 'boom', errors: { email: ['required'] } })
        notify('data', { eventType: 'INSERT' })

        expect(onRequest).toHaveBeenCalledWith({ resource: 'users', payload: {} })
        expect(onSuccess).toHaveBeenCalledWith({ ok: true })
        expect(onError).toHaveBeenCalledWith({ message: 'boom', errors: { email: ['required'] } })
        expect(onData).toHaveBeenCalledWith({ eventType: 'INSERT' })
    })

    it('dispatches connected and disconnected events to onConnected / onDisconnected', () => {
        const onConnected = vi.fn()
        const onDisconnected = vi.fn()

        const notify = createNotify({ onConnected, onDisconnected })

        notify('connected', { resource: 'messages' })
        notify('disconnected', { resource: 'messages' })

        expect(onConnected).toHaveBeenCalledWith({ resource: 'messages' })
        expect(onDisconnected).toHaveBeenCalledWith({ resource: 'messages' })
    })

    it('does not throw when no handler is registered for an event', () => {
        const notify = createNotify({})
        expect(() => notify('connected', {})).not.toThrow()
        expect(() => notify('disconnected', {})).not.toThrow()
    })
})
