import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { createSdk, defineResource } from '../src/index.ts'
import type { AnyResource, SdkDriver, SdkEventHandler, SdkResult, SdkResultError, SdkReturn } from '../src/index.ts'

interface ResultApi<T, TThrow extends boolean = false> {
    get(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, { rows: T[] }>>
    pick<E extends object = {}>(payload?: object): Promise<SdkReturn<TThrow, T & E>>
    watch(payload?: object, onEvent?: SdkEventHandler): () => void
}

declare module '../src/typed-sdk.ts' {
    interface ResourceApiKinds<T> {
        result: ResultApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        result: ResultApi<T, true>
    }
}

class ResultDriver implements SdkDriver {
    readonly name = 'result'
    declare readonly __apiUri: 'result'
    bindResource(_resourceName: string, _resource: AnyResource): void {}
}

type User = { id: number; name: string }

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const sdk = createSdk({ drivers: { result: new ResultDriver() }, resources: { result: { users } } })
const throwing = createSdk({ drivers: { result: new ResultDriver() }, resources: { result: { users } }, throw: true })

describe('default result object', () => {
    it('resolves a discriminated union', () => {
        expectTypeOf(sdk.result.users.get).returns.resolves.toEqualTypeOf<SdkResult<{ rows: User[] }>>()
    })

    it('narrows data once error is checked', async () => {
        const { data, error } = await sdk.result.users.get()
        if (error) {
            expectTypeOf(error).toEqualTypeOf<SdkResultError>()
            expectTypeOf(error.status).toEqualTypeOf<number | undefined>()
            expectTypeOf(data).toEqualTypeOf<undefined>()
        } else {
            expectTypeOf(data).toEqualTypeOf<{ rows: User[] }>()
            expectTypeOf(data.rows[0].name).toEqualTypeOf<string>()
        }
    })

    it('refuses data before the error is checked', async () => {
        const { data } = await sdk.result.users.get()
        // @ts-expect-error data may be undefined until error is checked
        void data.rows
    })

    it('keeps the generics of a method', async () => {
        const result = await sdk.result.users.pick<{ posts: number }>()
        if (!result.error) expectTypeOf(result.data.posts).toEqualTypeOf<number>()
    })

    it('leaves reactive methods unchanged', () => {
        expectTypeOf(sdk.result.users.watch).returns.toEqualTypeOf<() => void>()
    })
})

describe('throw: true', () => {
    it('resolves the bare type', async () => {
        expectTypeOf(throwing.result.users.get).returns.resolves.toEqualTypeOf<{ rows: User[] }>()
        const page = await throwing.result.users.get()
        expectTypeOf(page.rows[0].id).toEqualTypeOf<number>()
        expectTypeOf(await throwing.result.users.pick<{ posts: number }>()).toEqualTypeOf<User & { posts: number }>()
    })
})
