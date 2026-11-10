import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 300_000,
    },
})
