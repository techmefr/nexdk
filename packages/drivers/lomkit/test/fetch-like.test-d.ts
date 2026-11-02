import { describe, it } from 'vitest'
import { LomkitDriver } from '../src/driver.ts'
import type { FetchLike } from '../src/types.ts'

const narrow: FetchLike = async () => new Response('{}')

const withExtraMember = Object.assign(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'), {
    preconnect: (_url: string) => undefined,
})

describe('lomkit fetch option', () => {
    it('accepts a narrow function', () => {
        new LomkitDriver({ baseUrl: 'http://localhost', fetch: narrow })
    })

    it('accepts a fetch carrying an extra member without a cast', () => {
        new LomkitDriver({ baseUrl: 'http://localhost', fetch: withExtraMember })
    })

    it('still accepts the global fetch', () => {
        new LomkitDriver({ baseUrl: 'http://localhost', fetch })
    })
})
