import { LomkitDriver } from '@nexdk/driver-lomkit'
import { createNestDriver } from '@nexdk/driver-nest'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'
import { createStrapiDriver } from '@nexdk/driver-strapi'
import { createSymfonyDriver } from '@nexdk/driver-symfony'
import { SdkError, createSdk, defineResource } from 'nexdk'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { lomkitRepository, nestRepository, pocketbaseRepository, strapiRepository, symfonyRepository } from '../src/index.ts'
import {
    LOMKIT_URL,
    NEST_URL,
    POCKETBASE_URL,
    STRAPI_URL,
    SYMFONY_URL,
    lomkitBackend,
    nestBackend,
    pocketbaseBackend,
    strapiBackend,
    symfonyBackend,
} from './support/fakes.ts'
import { backend, json } from './support/http.ts'
import { Store } from './support/store.ts'

const numeric = defineResource({
    name: 'users',
    schema: z.object({ id: z.number(), name: z.string(), email: z.string(), age: z.number() }),
})

const textual = defineResource({
    name: 'users',
    schema: z.object({ id: z.string(), name: z.string(), email: z.string(), age: z.number() }),
})

const store = () => new Store(n => n)

describe('lomkit adapter', () => {
    const open = (fake = lomkitBackend(store())) => {
        const sdk = createSdk({
            drivers: { lomkit: new LomkitDriver({ baseUrl: LOMKIT_URL, fetch: fake.fetch }) },
            resources: { lomkit: { users: numeric } },
        })
        return { fake, sdk }
    }

    it('puts page and limit in the search and keeps the caller search', async () => {
        const { fake, sdk } = open()

        await lomkitRepository(sdk.lomkit.users).list({
            page: 2,
            perPage: 5,
            params: { search: { sorts: [{ field: 'age', direction: 'desc' }] } },
        })

        expect(fake.calls[0]!.body).toEqual({ search: { sorts: [{ field: 'age', direction: 'desc' }], page: 2, limit: 5 } })
    })

    it('never lets params override the requested page', async () => {
        const { fake, sdk } = open()

        await lomkitRepository(sdk.lomkit.users).list({ page: 3, perPage: 4, params: { search: { page: 1, limit: 99 } } })

        expect(fake.calls[0]!.body.search).toMatchObject({ page: 3, limit: 4 })
    })

    it('finds on the configured key', async () => {
        const { fake, sdk } = open()

        await lomkitRepository(sdk.lomkit.users, { key: 'email' }).find('user1@example.test')

        expect(fake.calls[0]!.body.search.filters).toEqual([{ field: 'email', operator: '=', value: 'user1@example.test' }])
    })

    it('has a null total when the backend sends none', async () => {
        const { sdk } = open(backend(() => json(200, { data: [{ id: 1, name: 'A1', email: 'a', age: 1 }] })))

        expect((await lomkitRepository(sdk.lomkit.users).list()).total).toBeNull()
    })

    it('strips the mutate prefix from validation field names and keeps status and data', async () => {
        const { sdk } = open()

        const error = (await lomkitRepository(sdk.lomkit.users)
            .create({ name: 'A' })
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(422)
        expect(Object.keys(error.errors as object)).toEqual(['name'])
        expect(error.data).toMatchObject({ errors: { 'mutate.0.attributes.name': expect.any(Array) } })
    })

    it('fails clearly when a create answers no id', async () => {
        const { sdk } = open(backend(() => json(200, { created: [], updated: [] })))

        const error = (await lomkitRepository(sdk.lomkit.users)
            .create({ name: 'Zoe' })
            .catch(e => e)) as SdkError

        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(0)
    })
})

describe('pocketbase adapter', () => {
    const open = (fake = pocketbaseBackend(new Store(n => `r${n}`))) => {
        const sdk = createSdk({
            drivers: { pocketbase: createPocketbaseDriver({ baseUrl: POCKETBASE_URL, fetch: fake.fetch }) },
            resources: { pocketbase: { users: textual } },
        })
        return { fake, sdk }
    }

    it('sends params with page and perPage and reads totalItems', async () => {
        const { fake, sdk } = open()

        const page = await pocketbaseRepository(sdk.pocketbase.users).list({
            page: 2,
            perPage: 5,
            params: { filter: 'age>30', sort: '-age' },
        })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('filter')).toBe('age>30')
        expect(searchParams.get('sort')).toBe('-age')
        expect(searchParams.get('page')).toBe('2')
        expect(searchParams.get('perPage')).toBe('5')
        expect(page.total).toBe(45)
        expect(fake.calls).toHaveLength(1)
    })

    it('has a null total when the server skips it', async () => {
        const { sdk } = open(backend(() => json(200, { page: 1, perPage: 2, totalItems: -1, totalPages: -1, items: [] })))

        expect((await pocketbaseRepository(sdk.pocketbase.users).list({ params: { skipTotal: true } })).total).toBeNull()
    })

    it('targets the id in the path even if the patch carries another id', async () => {
        const { fake, sdk } = open()

        await pocketbaseRepository(sdk.pocketbase.users).update('r1', { id: 'r2', age: 50 })

        expect(fake.calls[0]!.url.pathname).toBe('/api/collections/users/records/r1')
    })
})

describe('strapi adapter', () => {
    const open = (fake = strapiBackend(store())) => {
        const sdk = createSdk({
            drivers: { strapi: createStrapiDriver({ baseUrl: STRAPI_URL, fetch: fake.fetch }) },
            resources: { strapi: { users: numeric } },
        })
        return { fake, sdk }
    }

    it('sends params with the pagination and reads meta.pagination.total', async () => {
        const { fake, sdk } = open()

        const page = await strapiRepository(sdk.strapi.users).list({
            page: 2,
            perPage: 5,
            params: { sort: 'age:desc', populate: 'group' },
        })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('pagination[page]')).toBe('2')
        expect(searchParams.get('pagination[pageSize]')).toBe('5')
        expect(searchParams.get('sort')).toBe('age:desc')
        expect(searchParams.get('populate')).toBe('group')
        expect(page.total).toBe(45)
        expect(fake.calls).toHaveLength(1)
    })

    it('has a null total when meta is missing', async () => {
        const { sdk } = open(backend(() => json(200, { data: [] })))

        expect((await strapiRepository(sdk.strapi.users).list()).total).toBeNull()
    })
})

describe('nest adapter', () => {
    const open = (fake = nestBackend(store())) => {
        const sdk = createSdk({
            drivers: { nest: createNestDriver({ baseUrl: NEST_URL, fetch: fake.fetch }) },
            resources: { nest: { users: numeric } },
        })
        return { fake, sdk }
    }

    it('sends page and limit by default next to the params', async () => {
        const { fake, sdk } = open()

        await nestRepository(sdk.nest.users).list({ page: 2, perPage: 5, params: { name: 'User' } })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('page')).toBe('2')
        expect(searchParams.get('limit')).toBe('5')
        expect(searchParams.get('name')).toBe('User')
    })

    it('uses the paging function of the application', async () => {
        const { fake, sdk } = open()

        await nestRepository(sdk.nest.users, { paging: (page, perPage) => ({ skip: (page - 1) * perPage, take: perPage }) }).list({
            page: 3,
            perPage: 4,
        })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('skip')).toBe('8')
        expect(searchParams.get('take')).toBe('4')
        expect(searchParams.has('page')).toBe(false)
    })

    it('maps class-validator messages to field errors', async () => {
        const { sdk } = open()

        const error = (await nestRepository(sdk.nest.users)
            .create({ name: 'A' })
            .catch(e => e)) as SdkError

        expect(error.status).toBe(400)
        expect(error.errors).toEqual({ name: ['name must be longer than or equal to 2 characters'] })
    })
})

describe('symfony adapter', () => {
    const open = (fake = symfonyBackend(store())) => {
        const sdk = createSdk({
            drivers: { symfony: createSymfonyDriver({ baseUrl: SYMFONY_URL, fetch: fake.fetch }) },
            resources: { symfony: { users: numeric } },
        })
        return { fake, sdk }
    }

    it('sends page and itemsPerPage by default and reads totalItems', async () => {
        const { fake, sdk } = open()

        const page = await symfonyRepository(sdk.symfony.users).list({ page: 2, perPage: 5, params: { 'order[age]': 'desc' } })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('page')).toBe('2')
        expect(searchParams.get('itemsPerPage')).toBe('5')
        expect(searchParams.get('order[age]')).toBe('desc')
        expect(page.total).toBe(45)
    })

    it('uses the paging function of the application', async () => {
        const { fake, sdk } = open()

        await symfonyRepository(sdk.symfony.users, { paging: (page, perPage) => ({ p: page, size: perPage }) }).list({ page: 2, perPage: 3 })

        const { searchParams } = fake.calls[0]!.url
        expect(searchParams.get('p')).toBe('2')
        expect(searchParams.get('size')).toBe('3')
        expect(searchParams.has('itemsPerPage')).toBe(false)
    })

    it('has a null total when the collection has no totalItems', async () => {
        const { sdk } = open(backend(() => json(200, { 'hydra:member': [] })))

        expect((await symfonyRepository(sdk.symfony.users).list()).total).toBeNull()
    })
})
