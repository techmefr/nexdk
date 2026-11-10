export default defineNuxtConfig({
    modules: ['../../dist/module.mjs'],
    runtimeConfig: { public: { apiUrl: 'https://api.example.com' } },
    compatibilityDate: '2026-11-01',
    devtools: { enabled: false },
    telemetry: false,
})
