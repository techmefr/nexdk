import { fileURLToPath } from 'node:url'
import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('@nexdk/nuxt', async () => {
    await setup({ rootDir: fileURLToPath(new URL('./fixture', import.meta.url)), browser: true, setupTimeout: 300_000 })

    it('renders the data of useSdk() on the server', async () => {
        const html = await $fetch<string>('/')
        expect(html).toContain('Ann (server)')
        expect(html).toContain('Bob (server)')
        expect(html).toContain('>function</p>')
    })

    it('hydrates the server data and calls useSdk() on the client', async () => {
        const page = await createPage('/')
        await page.getByTestId('reload').click()
        await page.getByTestId('client').filter({ hasText: 'Ann' }).waitFor()
        expect(await page.getByTestId('client').textContent()).toBe('Ann:client,Bob:client')
        expect(await page.getByTestId('row').first().textContent()).toBe('Ann (server)')
        await page.close()
    })
})
