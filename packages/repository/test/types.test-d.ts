import { LomkitDriver } from '@nexdk/driver-lomkit'
import { createNestDriver } from '@nexdk/driver-nest'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'
import { createStrapiDriver } from '@nexdk/driver-strapi'
import { createSymfonyDriver } from '@nexdk/driver-symfony'
import type { FetchLike } from 'nexdk'
import { describe, expectTypeOf, it } from 'vitest'
import type { ListOptions, Page, Repository } from '../src/index.ts'

const narrow: FetchLike = async () => new Response('{}')

const withExtraMember = Object.assign(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'), {
    preconnect: (_url: string) => undefined,
})

describe('driver fetch options', () => {
    it('accept a narrow function and a fetch with an extra member without a cast', () => {
        for (const fetch of [narrow, withExtraMember]) {
            new LomkitDriver({ baseUrl: 'http://localhost', fetch })
            createPocketbaseDriver({ baseUrl: 'http://localhost', fetch })
            createStrapiDriver({ baseUrl: 'http://localhost', fetch })
            createNestDriver({ baseUrl: 'http://localhost', fetch })
            createSymfonyDriver({ baseUrl: 'http://localhost', fetch })
        }
    })
})

describe('repository types', () => {
    it('normalises a page', () => {
        expectTypeOf<Page<{ id: number }>>().toEqualTypeOf<{
            items: Array<{ id: number }>
            total: number | null
            page: number
            perPage: number
        }>()
    })

    it('types the list params per backend', () => {
        expectTypeOf<ListOptions<{ filter?: string }>['params']>().toEqualTypeOf<{ filter?: string } | undefined>()
        expectTypeOf<Repository<{ id: number }>['remove']>().returns.resolves.toBeVoid()
    })
})
