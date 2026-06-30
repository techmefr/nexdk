import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            beepr: resolve(__dirname, '../beepr/src/index.ts'),
        },
    },
    test: {
        globals: false,
    },
})
