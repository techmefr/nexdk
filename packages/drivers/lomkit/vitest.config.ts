import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            nexdk: resolve(__dirname, '../../../src/index.ts'),
            '@nexdk/http': resolve(__dirname, '../../http/src/index.ts'),
        },
    },
    test: {
        typecheck: { enabled: true, include: ['test/**/*.test-d.ts'] },
        globals: false,
    },
})
