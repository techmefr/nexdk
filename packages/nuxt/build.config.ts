import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
    entries: ['src/module', { builder: 'mkdist', input: 'src/runtime', outDir: 'dist/runtime' }],
    declaration: true,
    rollup: {
        emitCJS: false,
    },
    externals: ['@nuxt/kit', 'nexdk', 'nuxt', '#app', '#build/nexdk/config.mjs'],
})
