import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

function packageDirs(): string[] {
    const drivers = readdirSync(join(root, 'packages/drivers')).map((name) => `packages/drivers/${name}`)
    const shared = readdirSync(join(root, 'packages'))
        .filter((name) => name !== 'drivers')
        .map((name) => `packages/${name}`)
    return [...drivers, ...shared]
}

function typeTests(dir: string): string[] {
    const testDir = join(root, dir, 'test')
    if (!existsSync(testDir)) return []
    return readdirSync(testDir).filter((name) => name.endsWith('.test-d.ts'))
}

function includes(tsconfig: string): string[] {
    return JSON.parse(readFileSync(join(root, tsconfig), 'utf8')).include ?? []
}

describe('typecheck coverage', () => {
    it('checks the type tests of the core', () => {
        expect(typeTests('.').length).toBeGreaterThan(0)
        expect(includes('tsconfig.test.json')).toContain('test/**/*.test-d.ts')
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('tsc -p tsconfig.test.json')
    })

    it.each(packageDirs())('checks the type tests of %s', (dir) => {
        expect(includes(`${dir}/tsconfig.json`)).toContain('test/**/*.test-d.ts')
    })
})
