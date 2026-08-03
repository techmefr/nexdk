import { describe, expect, it, vi } from 'vitest'
import { createSdk } from '../src/create-sdk.ts'
import type { AnyResource, SdkDriver, SdkEventHandler } from '../src/types.ts'

class MockDriver implements SdkDriver {
    readonly name: string
    readonly calls: Array<{ resource: string; method: string; payload: unknown }> = []
    readonly boundResources: string[] = []

    constructor(name: string) {
        this.name = name
    }

    bindResource(resourceName: string, _resource: AnyResource): void {
        this.boundResources.push(resourceName)
    }

    get(resource: string, payload: unknown, onEvent?: SdkEventHandler, extra?: unknown): Promise<unknown> {
        this.calls.push({ resource, method: 'get', payload })
        const result = extra ?? { id: 1, fromDriver: this.name }
        onEvent?.('request', { resource, payload })
        onEvent?.('success', result)
        return Promise.resolve(result)
    }

    subscribe(resource: string, payload: unknown, onEvent?: SdkEventHandler): () => void {
        this.calls.push({ resource, method: 'subscribe', payload })
        onEvent?.('connected', { resource })
        return () => {}
    }
}

describe('createSdk', () => {
    it('exposes each driver by key', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })
        expect(sdk.lomkit).toBeDefined()
    })

    it('two drivers coexist without collision', () => {
        const lomkit = new MockDriver('lomkit')
        const nhost = new MockDriver('nhost')
        const sdk = createSdk({ drivers: { lomkit, nhost } })
        expect(sdk.lomkit).toBeDefined()
        expect(sdk.nhost).toBeDefined()
    })

    it('routes sdk.driver.resource.method to driver.method(resource, payload)', async () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })

        await sdk.lomkit.users.get({ id: 1 })

        expect(lomkit.calls).toHaveLength(1)
        expect(lomkit.calls[0]).toEqual({ resource: 'users', method: 'get', payload: { id: 1 } })
    })

    it('forwards the 4th call argument to the driver, opaque to the core', async () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })
        const extra = { id: 99, fromDriver: 'whatever the driver wants' }

        const result = await sdk.lomkit.users.get({ id: 99 }, undefined, extra)

        expect(result).toEqual(extra)
    })

    it('returns a cleanup function for reactive methods', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })

        const unsub = sdk.lomkit.messages.subscribe({ roomId: 1 })

        expect(typeof unsub).toBe('function')
    })

    it('throws when driver does not have the requested method', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })

        expect(() => sdk.lomkit.users.nonExistentMethod()).toThrow(
            'Driver "lomkit" has no method "nonExistentMethod"',
        )
    })

    it('fires global notify on every call', async () => {
        const lomkit = new MockDriver('lomkit')
        const events: string[] = []
        const sdk = createSdk({
            drivers: { lomkit },
            notify: event => events.push(event),
        })

        await sdk.lomkit.users.get({ id: 1 })

        expect(events.length).toBeGreaterThan(0)
    })

    it('passes through a plain property that exists on the driver', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })

        expect(sdk.lomkit.name).toBe('lomkit')
    })

    it('passes through and binds a method that exists on the driver', () => {
        const lomkit = new MockDriver('lomkit')
        const sdk = createSdk({ drivers: { lomkit } })

        sdk.lomkit.bindResource('users', {} as AnyResource)

        expect(lomkit.boundResources).toEqual(['users'])
    })

    it('merges global and per-call handlers, both fire', async () => {
        const lomkit = new MockDriver('lomkit')
        const globalEvents: string[] = []
        const localEvents: string[] = []
        const sdk = createSdk({
            drivers: { lomkit },
            notify: event => globalEvents.push(event),
        })

        await sdk.lomkit.users.get({ id: 1 }, event => localEvents.push(event))

        expect(globalEvents.length).toBeGreaterThan(0)
        expect(localEvents.length).toBeGreaterThan(0)
        expect(globalEvents).toEqual(localEvents)
    })
})
