import { describe, expect, it, vi } from 'vitest'
import { createPilota } from '../src/create-pilota.ts'
import type { AnyResource, PilotaDriver, PilotaEventHandler } from '../src/types.ts'

class MockDriver implements PilotaDriver {
    readonly name: string
    readonly calls: Array<{ resource: string; method: string; payload: unknown }> = []

    constructor(name: string) {
        this.name = name
    }

    bindResource(_resourceName: string, _resource: AnyResource): void {}

    get(resource: string, payload: unknown, onEvent?: PilotaEventHandler, mock?: unknown): Promise<unknown> {
        this.calls.push({ resource, method: 'get', payload })
        const result = mock ?? { id: 1, fromDriver: this.name }
        onEvent?.('request', { resource, payload })
        onEvent?.('success', result)
        return Promise.resolve(result)
    }

    subscribe(resource: string, payload: unknown, onEvent?: PilotaEventHandler): () => void {
        this.calls.push({ resource, method: 'subscribe', payload })
        onEvent?.('connected', { resource })
        return () => {}
    }
}

describe('createPilota', () => {
    it('exposes each driver by key', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createPilota({ drivers: { lomkit } })
        expect(sdk.lomkit).toBeDefined()
    })

    it('two drivers coexist without collision', () => {
        const lomkit = new MockDriver('lomkit')
        const nhost = new MockDriver('nhost')
        const sdk = createPilota({ drivers: { lomkit, nhost } })
        expect(sdk.lomkit).toBeDefined()
        expect(sdk.nhost).toBeDefined()
    })

    it('routes sdk.driver.resource.method to driver.method(resource, payload)', async () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createPilota({ drivers: { lomkit } })

        await sdk.lomkit.users.get({ id: 1 })

        expect(lomkit.calls).toHaveLength(1)
        expect(lomkit.calls[0]).toEqual({ resource: 'users', method: 'get', payload: { id: 1 } })
    })

    it('returns mock directly when provided (no real call check)', async () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createPilota({ drivers: { lomkit } })
        const mock = { id: 99, fromDriver: 'mock' }

        const result = await sdk.lomkit.users.get({ id: 99 }, undefined, mock)

        expect(result).toEqual(mock)
    })

    it('returns a cleanup function for reactive methods', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createPilota({ drivers: { lomkit } })

        const unsub = sdk.lomkit.messages.subscribe({ roomId: 1 })

        expect(typeof unsub).toBe('function')
    })

    it('throws when driver does not have the requested method', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createPilota({ drivers: { lomkit } })

        expect(() => sdk.lomkit.users.nonExistentMethod()).toThrow(
            'Driver "lomkit" has no method "nonExistentMethod"',
        )
    })

    it('fires global notify on every call', async () => {
        const lomkit = new MockDriver('lomkit')
        const events: string[] = []
        const sdk = createPilota({
            drivers: { lomkit },
            notify: event => events.push(event),
        })

        await sdk.lomkit.users.get({ id: 1 })

        expect(events.length).toBeGreaterThan(0)
    })

    it('merges global and per-call handlers, both fire', async () => {
        const lomkit = new MockDriver('lomkit')
        const globalEvents: string[] = []
        const localEvents: string[] = []
        const sdk = createPilota({
            drivers: { lomkit },
            notify: event => globalEvents.push(event),
        })

        await sdk.lomkit.users.get({ id: 1 }, event => localEvents.push(event))

        expect(globalEvents.length).toBeGreaterThan(0)
        expect(localEvents.length).toBeGreaterThan(0)
        expect(globalEvents).toEqual(localEvents)
    })
})
