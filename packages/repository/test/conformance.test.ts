import { LomkitDriver } from '@nexdk/driver-lomkit'
import { createNestDriver } from '@nexdk/driver-nest'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'
import { createStrapiDriver } from '@nexdk/driver-strapi'
import { createSymfonyDriver } from '@nexdk/driver-symfony'
import { createSdk, defineResource } from 'nexdk'
import { z } from 'zod'
import { lomkitRepository, nestRepository, pocketbaseRepository, strapiRepository, symfonyRepository } from '../src/index.ts'
import { defineConformance } from './conformance.ts'
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
import { Store, USER_COUNT } from './support/store.ts'

const numericUsers = defineResource({
    name: 'users',
    schema: z.object({ id: z.number(), name: z.string(), email: z.string(), age: z.number() }),
})

const stringUsers = defineResource({
    name: 'users',
    schema: z.object({ id: z.string(), name: z.string(), email: z.string(), age: z.number() }),
})

const numericStore = () => new Store(n => n)

defineConformance({
    name: 'lomkit',
    total: 'exact',
    count: USER_COUNT,
    missingId: 999999,
    open: async () => {
        const fake = lomkitBackend(numericStore())
        const sdk = createSdk({
            drivers: { lomkit: new LomkitDriver({ baseUrl: LOMKIT_URL, fetch: fake.fetch }) },
            resources: { lomkit: { users: numericUsers } },
        })
        return { repository: lomkitRepository(sdk.lomkit.users) }
    },
})

defineConformance({
    name: 'pocketbase',
    total: 'exact',
    count: USER_COUNT,
    missingId: 'unknownrecord01',
    open: async () => {
        const fake = pocketbaseBackend(new Store(n => `r${n}`))
        const sdk = createSdk({
            drivers: { pocketbase: createPocketbaseDriver({ baseUrl: POCKETBASE_URL, fetch: fake.fetch }) },
            resources: { pocketbase: { users: stringUsers } },
        })
        return { repository: pocketbaseRepository(sdk.pocketbase.users) }
    },
})

defineConformance({
    name: 'strapi',
    total: 'exact',
    count: USER_COUNT,
    missingId: 999999,
    open: async () => {
        const fake = strapiBackend(numericStore())
        const sdk = createSdk({
            drivers: { strapi: createStrapiDriver({ baseUrl: STRAPI_URL, fetch: fake.fetch }) },
            resources: { strapi: { users: numericUsers } },
        })
        return { repository: strapiRepository(sdk.strapi.users) }
    },
})

defineConformance({
    name: 'nest',
    total: 'unavailable',
    count: USER_COUNT,
    missingId: 999999,
    open: async () => {
        const fake = nestBackend(numericStore())
        const sdk = createSdk({
            drivers: { nest: createNestDriver({ baseUrl: NEST_URL, fetch: fake.fetch }) },
            resources: { nest: { users: numericUsers } },
        })
        return { repository: nestRepository(sdk.nest.users) }
    },
})

defineConformance({
    name: 'symfony',
    total: 'exact',
    count: USER_COUNT,
    missingId: 999999,
    open: async () => {
        const fake = symfonyBackend(numericStore())
        const sdk = createSdk({
            drivers: { symfony: createSymfonyDriver({ baseUrl: SYMFONY_URL, fetch: fake.fetch }) },
            resources: { symfony: { users: numericUsers } },
        })
        return { repository: symfonyRepository(sdk.symfony.users) }
    },
})
