import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            nexdk: resolve(__dirname, '../../../src/index.ts'),
        },
    },
    test: {
        globals: false,
    },
})
