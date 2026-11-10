import { addImports, addPlugin, addTemplate, addTypeTemplate, createResolver, defineNuxtModule, findPath } from '@nuxt/kit'
import type { NuxtModule } from 'nuxt/schema'

export interface ModuleOptions {
    sdk: string
}

function sdkTypes(configPath: string): string {
    return `import type { TypedSdk } from 'nexdk'

type SdkConfigExport = typeof import(${JSON.stringify(configPath)}).default
type ResolvedSdkConfig = SdkConfigExport extends (...args: any[]) => infer R ? Awaited<R> : SdkConfigExport
type ResolvedSdk = TypedSdk<
    ResolvedSdkConfig['drivers'],
    ResolvedSdkConfig extends { resources?: infer R } ? NonNullable<R> : Record<never, never>,
    ResolvedSdkConfig extends { throw?: infer T } ? ([T] extends [true] ? true : false) : false
>

declare module '#app' {
    interface NuxtApp {
        $sdk: ResolvedSdk
    }
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $sdk: ResolvedSdk
    }
}

export {}
`
}

function missingConfig(sdk: string): Error {
    return new Error(
        `[@nexdk/nuxt] SDK config file not found: "${sdk}". Create it (by default app/sdk.config.ts in Nuxt 4) or point the "nexdk.sdk" option of nuxt.config to it.`,
    )
}

const nexdkModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
    meta: { name: '@nexdk/nuxt', configKey: 'nexdk', compatibility: { nuxt: '>=4.0.0' } },
    defaults: { sdk: '~/sdk.config' },
    async setup(options) {
        const resolver = createResolver(import.meta.url)
        const configPath = await findPath(options.sdk)
        if (configPath === null) throw missingConfig(options.sdk)

        addTemplate({
            filename: 'nexdk/config.mjs',
            getContents: () => `export { default } from ${JSON.stringify(configPath)}\n`,
        })
        addTypeTemplate({ filename: 'types/nexdk.d.ts', getContents: () => sdkTypes(configPath) })
        addPlugin(resolver.resolve('./runtime/plugin'))
        addImports([
            { name: 'useSdk', from: resolver.resolve('./runtime/use-sdk') },
            { name: 'defineSdkConfig', from: 'nexdk' },
        ])
    },
})

export default nexdkModule
