export default defineNuxtConfig({
    modules: ['../../dist/module.mjs'],
    nexdk: { sdk: '~/sdk.config' },
    compatibilityDate: '2026-11-01',
    devtools: { enabled: false },
    telemetry: false,
})
