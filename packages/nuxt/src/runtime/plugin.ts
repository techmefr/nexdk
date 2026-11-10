import { createSdk } from 'nexdk'
import type { SdkConfig, SdkDriver } from 'nexdk'
import { defineNuxtPlugin } from '#app'
import type { NuxtApp } from '#app'
import config from '#build/nexdk/config.mjs'

type AnySdkConfig = SdkConfig<Record<string, SdkDriver>>
type SdkConfigSource = AnySdkConfig | ((nuxtApp: NuxtApp) => AnySdkConfig | Promise<AnySdkConfig>)

export default defineNuxtPlugin({
    name: 'nexdk',
    async setup(nuxtApp) {
        const source = config as SdkConfigSource
        const resolved = typeof source === 'function' ? await source(nuxtApp) : source
        return { provide: { sdk: createSdk(resolved) } }
    },
})
