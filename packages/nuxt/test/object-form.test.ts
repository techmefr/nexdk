import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('@nexdk/nuxt with an object config', async () => {
    await setup({ rootDir: fileURLToPath(new URL('./fixture-object', import.meta.url)), setupTimeout: 300_000 })

    it('renders the bare value of a throw: true call on the server', async () => {
        const html = await $fetch<string>('/')
        expect(html).toMatch(/data-testid="name">call \d+<\/p>/)
    })

    it('shares one config object, so its state lives across requests', async () => {
        const first = Number((await $fetch<string>('/')).match(/call (\d+)/)?.[1])
        const second = Number((await $fetch<string>('/')).match(/call (\d+)/)?.[1])
        expect(second).toBeGreaterThan(first)
    })
})
