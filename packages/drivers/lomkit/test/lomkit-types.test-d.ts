import { createSdk, defineResource } from 'nexdk'
import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { LomkitDriver } from '../src/driver.ts'
import type {
    LomkitActionResult,
    LomkitBulkResult,
    LomkitDeleteResult,
    LomkitDetailsResult,
    LomkitGateValue,
    LomkitGates,
    LomkitGetResult,
    LomkitMeta,
    LomkitMutatePayload,
    LomkitRelationOperation,
    LomkitRelations,
    LomkitSearch,
} from '../src/types.ts'

const user = defineResource({
    name: 'users',
    schema: z.object({ id: z.number(), name: z.string(), age: z.number() }),
})

const sdk = createSdk({
    drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://localhost' }) },
    resources: { lomkit: { users: user } },
})

type User = { id: number; name: string; age: number }

describe('gates', () => {
    it('accepts the gate names the backend validates and rejects others', () => {
        sdk.lomkit.users.get({ search: { gates: ['create', 'view', 'update', 'delete', 'restore', 'forceDelete', 'viewAny'] } })
        // @ts-expect-error unknown gate
        sdk.lomkit.users.get({ search: { gates: ['publish'] } })
    })

    it('types the gates of each row and of meta', async () => {
        const page = await sdk.lomkit.users.get({ search: { gates: ['update'] } })
        expectTypeOf(page.data[0].name).toEqualTypeOf<string>()
        expectTypeOf(page.data[0].gates).toEqualTypeOf<LomkitGates | undefined>()
        expectTypeOf(page.data[0].gates!.authorized_to_update).toEqualTypeOf<LomkitGateValue | undefined>()
        expectTypeOf(page.meta).toEqualTypeOf<LomkitMeta | undefined>()
        expectTypeOf(page.meta!.gates).toEqualTypeOf<LomkitGates | undefined>()
    })

    it('accepts both gate schemas', () => {
        expectTypeOf<boolean>().toMatchTypeOf<LomkitGateValue>()
        expectTypeOf<{ allowed: boolean; message: string | null }>().toMatchTypeOf<LomkitGateValue>()
    })
})

describe('search payload', () => {
    it('types filters, sorts, selects, scopes, aggregates, includes and instructions', () => {
        sdk.lomkit.users.get({
            search: {
                text: { value: 'ann', trashed: 'with' },
                filters: [
                    { field: 'name', operator: 'like', value: 'A%' },
                    { type: 'or', nested: [{ field: 'age', operator: '>=', value: 18 }, { field: 'age', value: null }] },
                ],
                sorts: [{ field: 'age', direction: 'desc' }],
                selects: [{ field: 'id' }],
                scopes: [{ name: 'olderThan', parameters: [30] }],
                aggregates: [
                    { relation: 'posts', type: 'count', alias: 'posts_total', filters: [{ field: 'published', value: true }] },
                    { relation: 'posts', type: 'sum', field: 'views' },
                ],
                includes: [{ relation: 'posts', sorts: [{ field: 'id' }], includes: [{ relation: 'tags' }], limit: 5 }],
                instructions: [{ name: 'active-only', fields: [{ name: 'min_age', value: 30 }] }],
                limit: 10,
                page: 2,
            },
        })
    })

    it('rejects values the backend would refuse', () => {
        // @ts-expect-error unknown sort direction
        sdk.lomkit.users.get({ search: { sorts: [{ field: 'name', direction: 'up' }] } })
        // @ts-expect-error a scope needs a name
        sdk.lomkit.users.get({ search: { scopes: [{ parameters: [1] }] } })
        // @ts-expect-error an instruction needs a name
        sdk.lomkit.users.get({ search: { instructions: [{ fields: [] }] } })
        // @ts-expect-error an include needs a relation
        sdk.lomkit.users.get({ search: { includes: [{ limit: 5 }] } })
        // @ts-expect-error limit is a number
        sdk.lomkit.users.get({ search: { limit: '10' } })
    })

    it('keeps loosely typed payloads compiling', () => {
        sdk.lomkit.users.get()
        sdk.lomkit.users.get({})
        const loose: Record<string, unknown> = { search: { limit: 5 } }
        sdk.lomkit.users.get(loose)
        expectTypeOf<LomkitSearch>().toHaveProperty('aggregates')
    })

    it('lets a row carry the extra keys of aggregates and includes', async () => {
        const page = await sdk.lomkit.users.get<{ posts_count: number; posts: { id: number }[] }>({
            search: { aggregates: [{ relation: 'posts', type: 'count' }], includes: [{ relation: 'posts' }] },
        })
        expectTypeOf(page.data[0].posts_count).toEqualTypeOf<number>()
        expectTypeOf(page.data[0].posts).toEqualTypeOf<{ id: number }[]>()
        expectTypeOf(page.data[0].age).toEqualTypeOf<number>()
        expectTypeOf(page).toEqualTypeOf<LomkitGetResult<User, { posts_count: number; posts: { id: number }[] }>>()
    })
})

describe('mutate relations', () => {
    it('accepts every relation operation, single or list, nested', () => {
        sdk.lomkit.users.mutate({
            operation: 'create',
            attributes: { name: 'Alice' },
            relations: {
                manager: { operation: 'attach', key: 1 },
                posts: [
                    { operation: 'create', attributes: { title: 'First' }, relations: { tags: { operation: 'sync', key: [1, 2], without_detaching: true } } },
                    { operation: 'update', key: 3, attributes: { title: 'Renamed' } },
                    { operation: 'detach', key: 4 },
                ],
                roles: [
                    { operation: 'toggle', key: [1, 2], pivot: { level: 1 } },
                    { operation: 'sync', key: ['a'], pivot: { level: 2 } },
                    { operation: 'attach', key: 'b', pivot: { level: 3 } },
                ],
            },
        })
    })

    it('rejects an operation without its required parts', () => {
        // @ts-expect-error update needs a key
        const update: LomkitRelationOperation = { operation: 'update', attributes: { title: 'x' } }
        // @ts-expect-error attach needs a key
        const attach: LomkitRelationOperation = { operation: 'attach' }
        // @ts-expect-error unknown operation
        const unknown: LomkitRelationOperation = { operation: 'merge', key: 1 }
        void [update, attach, unknown]
    })

    it('rejects parts the backend prohibits', () => {
        // @ts-expect-error attach prohibits attributes
        const attach: LomkitRelationOperation = { operation: 'attach', key: 1, attributes: { title: 'x' } }
        // @ts-expect-error detach prohibits attributes
        const detach: LomkitRelationOperation = { operation: 'detach', key: 1, attributes: { title: 'x' } }
        // @ts-expect-error detach prohibits pivot
        const pivot: LomkitRelationOperation = { operation: 'detach', key: 1, pivot: { level: 1 } }
        // @ts-expect-error create prohibits key
        const create: LomkitRelationOperation = { operation: 'create', key: 1 }
        // @ts-expect-error without_detaching only belongs to sync
        const toggle: LomkitRelationOperation = { operation: 'toggle', key: 1, without_detaching: true }
        void [attach, detach, pivot, create, toggle]
    })

    it('types nested relations and the relations of a payload', () => {
        const nested: LomkitRelations = {
            posts: { operation: 'create', relations: { tags: [{ operation: 'attach', key: 1 }] } },
        }
        // @ts-expect-error a nested relation is checked too
        const bad: LomkitRelations = { posts: { operation: 'create', relations: { tags: { operation: 'attach' } } } }
        void [nested, bad]
        expectTypeOf<LomkitMutatePayload<User>['relations']>().toEqualTypeOf<LomkitRelations | undefined>()
    })
})

describe('other operations', () => {
    it('types delete, restore, forceDelete, actions and details', () => {
        expectTypeOf(sdk.lomkit.users.delete).returns.resolves.toEqualTypeOf<LomkitDeleteResult>()
        expectTypeOf(sdk.lomkit.users.restore).returns.resolves.toEqualTypeOf<LomkitBulkResult<User>>()
        expectTypeOf(sdk.lomkit.users.forceDelete).returns.resolves.toEqualTypeOf<LomkitBulkResult<User>>()
        expectTypeOf(sdk.lomkit.users.actions).returns.resolves.toEqualTypeOf<LomkitActionResult>()
        expectTypeOf(sdk.lomkit.users.details).returns.resolves.toEqualTypeOf<LomkitDetailsResult>()
    })

    it('types the action body and the ids', async () => {
        sdk.lomkit.users.restore({ resources: [1, 'a'] })
        sdk.lomkit.users.forceDelete({ resources: [1] })
        sdk.lomkit.users.actions({ name: 'archive', resources: [1, 2], fields: [{ name: 'reason', value: 'x' }] })
        sdk.lomkit.users.actions({ name: 'purge', search: { filters: [{ field: 'age', operator: '<', value: 3 }] } })
        // @ts-expect-error restore needs resources
        sdk.lomkit.users.restore({})
        // @ts-expect-error an action needs a name
        sdk.lomkit.users.actions({ resources: [1] })
        const result = await sdk.lomkit.users.actions({ name: 'archive' })
        expectTypeOf(result.data.impacted).toEqualTypeOf<number>()
        const details = await sdk.lomkit.users.details()
        expectTypeOf(details.data.actions[0].uriKey).toEqualTypeOf<string>()
        expectTypeOf(details.data.fields).toEqualTypeOf<string[]>()
        expectTypeOf(details.data.relations[0].constraints.required_on_creation).toEqualTypeOf<boolean>()
    })
})
