import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

interface PackageInfo {
    name: string
    dir: string
    docPage: string
    peers: string[]
}

function listPackages(): PackageInfo[] {
    const entries = [
        ...readdirSync(join(root, 'packages/drivers')).map((name) => ({
            dir: `packages/drivers/${name}`,
            docPage: `docs/src/content/docs/drivers/${name}.md`,
        })),
        ...['http', 'hooks', 'nuxt'].map((name) => ({
            dir: `packages/${name}`,
            docPage: `docs/src/content/docs/packages/${name}.md`,
        })),
    ]
    return entries.map(({ dir, docPage }) => {
        const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
        const optional = Object.entries(manifest.peerDependenciesMeta ?? {})
            .filter(([, meta]) => (meta as { optional?: boolean }).optional)
            .map(([name]) => name)
        const peers = Object.keys(manifest.peerDependencies ?? {}).filter((peer) => !optional.includes(peer))
        return { name: manifest.name, dir, docPage, peers }
    })
}

function installCommands(markdown: string): string[] {
    return markdown
        .split('\n')
        .filter((line) => line.startsWith('pnpm add '))
        .map((line) => line.slice('pnpm add '.length).split(' '))
        .map((words) => words.join(' '))
}

function documents(pkg: PackageInfo): Record<string, string> {
    return {
        [`${pkg.dir}/README.md`]: readFileSync(join(root, pkg.dir, 'README.md'), 'utf8'),
        [pkg.docPage]: readFileSync(join(root, pkg.docPage), 'utf8'),
    }
}

describe('documented install commands', () => {
    for (const pkg of listPackages()) {
        describe(pkg.name, () => {
            for (const [path, markdown] of Object.entries(documents(pkg))) {
                it(`${path} installs the package and every required peer`, () => {
                    const commands = installCommands(markdown).filter((command) => command.split(' ').includes(pkg.name))
                    expect(commands.length).toBeGreaterThan(0)
                    for (const command of commands) {
                        const words = command.split(' ')
                        for (const peer of pkg.peers) expect(words, `${peer} missing in "pnpm add ${command}"`).toContain(peer)
                    }
                })
            }
        })
    }

    it('lists every package of the workspace', () => {
        expect(listPackages().length).toBeGreaterThanOrEqual(10)
        for (const pkg of listPackages()) expect(existsSync(join(root, pkg.docPage))).toBe(true)
    })

    it('shows the lomkit install with @nexdk/http in the root README', () => {
        const readme = readFileSync(join(root, 'README.md'), 'utf8')
        expect(installCommands(readme)).toContain('nexdk @nexdk/http @nexdk/driver-lomkit')
    })
})
