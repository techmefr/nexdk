import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { createSdk, defineResource, defineSdkConfig } from '../src/index.ts'
import type { AnyResource, SdkDriver, SdkEventHandler, SdkResult, SdkReturn, TypedSdk } from '../src/index.ts'

interface ConfigApi<T, TThrow extends boolean = false> {
    get(payload?: object, onEvent?: SdkEventHandler): Promise<SdkReturn<TThrow, T[]>>
}

declare module '../src/typed-sdk.ts' {
    interface ResourceApiKinds<T> {
        configured: ConfigApi<T>
    }
    interface ThrowingResourceApiKinds<T> {
        configured: ConfigApi<T, true>
    }
}

class ConfiguredDriver implements SdkDriver {
    readonly name = 'configured'
    declare readonly __apiUri: 'configured'
    bindResource(_resourceName: string, _resource: AnyResource): void {}
}

type User = { id: number; name: string }

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

type SdkOf<C> = C extends { drivers: infer D extends Record<string, SdkDriver>; resources?: infer R }
    ? TypedSdk<D, NonNullable<R> & object, C extends { throw?: infer T } ? ([T] extends [true] ? true : false) : false>
    : never

describe('defineSdkConfig', () => {
    it('keeps throw: true literal, so a call resolves the bare value', () => {
        const config = defineSdkConfig({ drivers: { configured: new ConfiguredDriver() }, resources: { configured: { users } }, throw: true })
        expectTypeOf(config.throw).toEqualTypeOf<true | undefined>()
        expectTypeOf(createSdk(config).configured.users.get).returns.resolves.toEqualTypeOf<User[]>()
        expectTypeOf<SdkOf<typeof config>['configured']['users']['get']>().returns.resolves.toEqualTypeOf<User[]>()
    })

    it('defaults to the { data, error } result', () => {
        const config = defineSdkConfig({ drivers: { configured: new ConfiguredDriver() }, resources: { configured: { users } } })
        expectTypeOf(createSdk(config).configured.users.get).returns.resolves.toEqualTypeOf<SdkResult<User[]>>()
    })

    it('shows the widening it prevents', () => {
        const widened = { drivers: { configured: new ConfiguredDriver() }, resources: { configured: { users } }, throw: true }
        expectTypeOf(widened.throw).toEqualTypeOf<boolean>()
    })

    it('rejects resources of an unknown driver', () => {
        // @ts-expect-error the driver "missing" is not configured
        defineSdkConfig({ drivers: { configured: new ConfiguredDriver() }, resources: { missing: { users } } })
    })
})
