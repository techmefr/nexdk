import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            nexdk: resolve(__dirname, '../../nexdk/src/index.ts'),
            beepr: resolve(__dirname, '../../beepr/src/index.ts'),
        },
    },
    test: {
        globals: false,
    },
})
