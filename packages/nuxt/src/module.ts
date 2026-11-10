import { addImports, addPlugin, addTemplate, addTypeTemplate, createResolver, defineNuxtModule, resolvePath } from '@nuxt/kit'
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
    ResolvedSdkConfig extends { resources: infer R } ? NonNullable<R> : Record<never, never>,
    ResolvedSdkConfig extends { throw: true } ? true : false
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

const nexdkModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
    meta: { name: '@nexdk/nuxt', configKey: 'nexdk' },
    defaults: { sdk: '~/sdk.config' },
    async setup(options) {
        const resolver = createResolver(import.meta.url)
        const configPath = await resolvePath(options.sdk)

        addTemplate({
            filename: 'nexdk/config.mjs',
            getContents: () => `export { default } from ${JSON.stringify(configPath)}\n`,
        })
        addTypeTemplate({ filename: 'types/nexdk.d.ts', getContents: () => sdkTypes(configPath) })
        addPlugin(resolver.resolve('./runtime/plugin'))
        addImports({ name: 'useSdk', from: resolver.resolve('./runtime/use-sdk') })
    },
})

export default nexdkModule
