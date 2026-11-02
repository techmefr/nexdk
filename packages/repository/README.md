# @nexdk/repository

One `list`, `find`, `create`, `update`, `remove` interface over the nexdk REST drivers, with a normalised page and nexdk errors. Adapters for lomkit, pocketbase, strapi, nest and symfony. No runtime dependency: `nexdk` is a peer, each driver an optional peer.

Not published to npm yet: build it from the [repository](https://github.com/techmefr/nexdk) (`packages/repository`). Full documentation: [nexdk docs](https://techmefr.github.io/nexdk/packages/repository/).

```ts
import { createSdk, defineResource } from 'nexdk'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'
import { pocketbaseRepository } from '@nexdk/repository'
import { z } from 'zod'

const users = defineResource({
    name: 'users',
    schema: z.object({ id: z.string(), name: z.string(), age: z.number() }),
})

const sdk = createSdk({
    drivers: { pocketbase: createPocketbaseDriver({ baseUrl: 'http://localhost:8090' }) },
    resources: { pocketbase: { users } },
})

const repository = pocketbaseRepository(sdk.pocketbase.users)

const { items, total, page, perPage } = await repository.list({ page: 2, perPage: 10, params: { filter: 'age>30' } })
const created = await repository.create({ name: 'Zoe', age: 31 })
await repository.update(created.id, { age: 32 })
await repository.remove(created.id)
```

## Page

`{ items, total, page, perPage }`. `total` comes from the backend when it sends one (PocketBase `totalItems`, Strapi `meta.pagination.total`, Lomkit `total`, Symfony `totalItems`), otherwise it is `null` (Nest, PocketBase with `skipTotal`).

## Errors

An `SdkError` from `nexdk`: `status`, `errors` keyed by field, `data`. A missing record is status 404 on every backend.

## Not covered

Supabase (no range or count in the driver), Firebase (token pages, no total) and Nhost (GraphQL).

## Tests

`pnpm --filter @nexdk/repository test` runs the shared conformance suite (`test/conformance.ts`) against a fake `fetch` for every adapter. Add a target to run it against a real backend.
