import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const fixture = fileURLToPath(new URL('./fixture', import.meta.url))
const objectFixture = fileURLToPath(new URL('./fixture-object', import.meta.url))
const docFixture = fileURLToPath(new URL('./fixture-doc', import.meta.url))
const missingFixture = fileURLToPath(new URL('./fixture-missing', import.meta.url))
const bin = (name: string) => fileURLToPath(new URL(`../node_modules/.bin/${name}`, import.meta.url))
const readme = fileURLToPath(new URL('../README.md', import.meta.url))
const docPage = fileURLToPath(new URL('../../../docs/src/content/docs/packages/nuxt.md', import.meta.url))

function typecheck(root: string): () => void {
    execFileSync(bin('nuxi'), ['prepare', root], { stdio: 'pipe' })
    return () => execFileSync(bin('tsc'), ['-p', `${root}/.nuxt/tsconfig.app.json`, '--noEmit'], { stdio: 'pipe' })
}

function tsBlocks(file: string): string[] {
    return [...readFileSync(file, 'utf8').matchAll(/```ts\n([\s\S]*?)```/g)].map(match => match[1])
}

function docExample(file: string): { config: string; usage: string } {
    const blocks = tsBlocks(file)
    const config = blocks.find(block => block.includes('defineSdkConfig('))
    const usage = blocks.find(block => block.includes('useSdk()'))
    if (config === undefined || usage === undefined) throw new Error(`no SDK config or usage example in ${file}`)
    return { config, usage }
}

describe('@nexdk/nuxt types', () => {
    afterAll(() => rmSync(`${docFixture}/app`, { recursive: true, force: true }))

    it('types useSdk() and $sdk from the config file', () => {
        expect(typecheck(fixture)).not.toThrow()
    })

    it('types an object config with throw: true as the bare value', () => {
        expect(typecheck(objectFixture)).not.toThrow()
    })

    it('typechecks the example of the README and the doc page, which are the same', () => {
        const example = docExample(readme)
        expect(docExample(docPage)).toEqual(example)
        mkdirSync(`${docFixture}/app`, { recursive: true })
        writeFileSync(`${docFixture}/app/app.vue`, '<template>\n    <main />\n</template>\n')
        writeFileSync(`${docFixture}/app/sdk.config.ts`, example.config)
        writeFileSync(`${docFixture}/app/usage.ts`, `export async function usage() {\n${example.usage}    return { data, error }\n}\n`)
        expect(typecheck(docFixture)).not.toThrow()
    })

    it('stops with the expected path and the option name when the config file is missing', () => {
        const prepare = () => execFileSync(bin('nuxi'), ['prepare', missingFixture], { stdio: 'pipe', encoding: 'utf8' })
        let output = ''
        try {
            prepare()
        } catch (error) {
            const failed = error as { stdout?: string; stderr?: string }
            output = `${failed.stdout ?? ''}${failed.stderr ?? ''}`
        }
        expect(output).toContain('SDK config file not found: "~/sdk.config"')
        expect(output).toContain('nexdk.sdk')
    })
})
