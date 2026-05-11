import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@pilota/core': resolve(__dirname, '../../core/src/index.ts'),
        },
    },
    test: {
        globals: false,
    },
})
