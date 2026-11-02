import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            nexdk: resolve(__dirname, '../../src/index.ts'),
            '@nexdk/http': resolve(__dirname, '../http/src/index.ts'),
            '@nexdk/driver-lomkit': resolve(__dirname, '../drivers/lomkit/src/index.ts'),
            '@nexdk/driver-nest': resolve(__dirname, '../drivers/nest/src/index.ts'),
            '@nexdk/driver-pocketbase': resolve(__dirname, '../drivers/pocketbase/src/index.ts'),
            '@nexdk/driver-strapi': resolve(__dirname, '../drivers/strapi/src/index.ts'),
            '@nexdk/driver-symfony': resolve(__dirname, '../drivers/symfony/src/index.ts'),
        },
    },
    test: {
        globals: false,
        include: ['test/**/*.test.ts'],
        typecheck: { enabled: true, include: ['test/**/*.test-d.ts'] },
    },
})
