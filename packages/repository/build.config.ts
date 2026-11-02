import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
    entries: ['src/index'],
    declaration: true,
    rollup: {
        emitCJS: false,
    },
    externals: [
        'nexdk',
        '@nexdk/driver-lomkit',
        '@nexdk/driver-nest',
        '@nexdk/driver-pocketbase',
        '@nexdk/driver-strapi',
        '@nexdk/driver-symfony',
    ],
})
