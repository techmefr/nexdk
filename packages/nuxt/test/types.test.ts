import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fixture = fileURLToPath(new URL('./fixture', import.meta.url))
const bin = (name: string) => fileURLToPath(new URL(`../node_modules/.bin/${name}`, import.meta.url))

describe('@nexdk/nuxt types', () => {
    it('types useSdk() and $sdk from the config file', () => {
        execFileSync(bin('nuxi'), ['prepare', fixture], { stdio: 'pipe' })
        const run = () => execFileSync(bin('tsc'), ['-p', `${fixture}/.nuxt/tsconfig.app.json`, '--noEmit'], { stdio: 'pipe' })
        expect(run).not.toThrow()
    })
})
