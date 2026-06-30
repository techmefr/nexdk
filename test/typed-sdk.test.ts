import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createPilota } from '../src/create-pilota.ts'
import { defineResource } from '../src/define-resource.ts'
import type { AnyResource, PilotaDriver, PilotaEventHandler } from '../src/types.ts'

// A driver exposing a typed, generic per-resource API, exactly like the real
// driver packages do. `get` returns the resource type wrapped in { data }.
interface MockResourceApi<T> {
    get(payload?: object, onEvent?: PilotaEventHandler): Promise<{ data: T }>
}

// Register the mock API in core's registry (same mechanism the real drivers use).
declare module '../src/typed-sdk.ts' {
    interface ResourceApiKinds<T> {
        mock: MockResourceApi<T>
    }
}

class TypedMockDriver implements PilotaDriver {
    readonly name = 'mock'
    declare readonly __apiUri: 'mock'

    readonly bound: string[] = []
    bindResource(resourceName: string, _resource: AnyResource): void {
        this.bound.push(resourceName)
    }

    get(resource: string, payload: unknown): Promise<{ data: unknown }> {
        return Promise.resolve({ data: { id: 1, name: resource, payload } })
    }
}

const userResource = defineResource({
    name: 'users',
    schema: z.object({ id: z.number(), name: z.string() }),
})

describe('typed SDK', () => {
    it('binds declared resources through createPilota', () => {
        const mock = new TypedMockDriver()
        createPilota({ drivers: { mock }, resources: { mock: { users: userResource } } })
        expect(mock.bound).toEqual(['users'])
    })

    it('exposes declared resources with the driver method surface', async () => {
        const mock = new TypedMockDriver()
        const sdk = createPilota({
            drivers: { mock },
            resources: { mock: { users: userResource } },
        })

        // Positive: the inferred type flows through — `user` is { id; name }.
        const result = await sdk.mock.users.get({ id: 1 })
        const user: { id: number; name: string } = result.data
        expect(user).toBeDefined()
    })

    it('type-checks: undeclared resource and bad usage are type errors', async () => {
        const mock = new TypedMockDriver()
        const sdk = createPilota({
            drivers: { mock },
            resources: { mock: { users: userResource } },
        })

        // @ts-expect-error - "orders" was not declared in resources
        sdk.mock.orders.get({})

        const { data } = await sdk.mock.users.get({})
        // @ts-expect-error - data is { id: number; name: string }, not a string
        const wrong: string = data
        void wrong
    })
})
