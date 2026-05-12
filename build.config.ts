import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
    entries: ['src/index'],
    declaration: true,
    rollup: {
        emitCJS: false,
    },
    externals: ['zod', 'vue', '@pilota/core', 'hookable', 'miragejs'],
})
