import { createSdk, defineResource } from 'nexdk'
import type { WriteInput } from 'nexdk'
import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'
import type { LomkitMutatePayload, LomkitMutateResult } from '../src/types.ts'

const userResource = defineResource({
    name: 'users',
    schema: z.object({ id: z.number(), name: z.string(), age: z.number() }),
})

const sdk = createSdk({
    drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://localhost' }) },
    resources: { lomkit: { users: userResource } },
})

type User = { id: number; name: string; age: number }

describe('lomkit mutate payload types', () => {
    it('types attributes as a partial of the schema output', () => {
        expectTypeOf<LomkitMutatePayload<User>['attributes']>().toEqualTypeOf<WriteInput<User> | undefined>()
    })

    it('keeps the schema fields typed for reading', () => {
        expectTypeOf<NonNullable<LomkitMutatePayload<User>['attributes']>['age']>().toEqualTypeOf<number | undefined>()
        expectTypeOf<NonNullable<LomkitMutatePayload<User>['attributes']>['password']>().toBeAny()
    })

    it('accepts an interface as the write body', () => {
        interface NewUser {
            name: string
            password: string
        }
        const body: NewUser = { name: 'Alice', password: 'secret' }
        sdk.lomkit.users.mutate({ operation: 'create', attributes: body })
    })

    it('accepts input fields that the resource does not return', () => {
        sdk.lomkit.users.mutate({ operation: 'create', attributes: { name: 'Alice', password: 'secret' } })
        sdk.lomkit.users.mutate({ attributes: { nickname: 'x' } })
    })

    it('accepts a valid partial update', () => {
        sdk.lomkit.users.mutate({ operation: 'update', key: 1, attributes: { age: 3 } })
        sdk.lomkit.users.mutate({ operation: 'create', attributes: { name: 'Alice' }, relations: { posts: [] } })
    })

    it('keeps existing loosely-typed usages compiling', () => {
        sdk.lomkit.users.mutate()
        sdk.lomkit.users.mutate({})
        sdk.lomkit.users.mutate({ name: 'Alice' })
        const loose: Record<string, unknown> = { operation: 'update' }
        sdk.lomkit.users.mutate(loose)
    })

    it('rejects attributes that do not match the schema', () => {
        // @ts-expect-error age must be a number
        sdk.lomkit.users.mutate({ attributes: { age: 'old' } })
        // @ts-expect-error a schema field keeps its type even with extra input fields
        sdk.lomkit.users.mutate({ attributes: { age: 'old', password: 'secret' } })
    })

    it('still resolves the result type from the schema', () => {
        expectTypeOf(sdk.lomkit.users.mutate).returns.resolves.toEqualTypeOf<LomkitMutateResult>()
    })
})
