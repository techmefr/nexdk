---
title: '@nexdk/repository'
description: One list, find, create, update and remove interface over the nexdk REST drivers, with a normalised page.
---

The drivers share a grammar, not an API: `sdk.pocketbase.users.get()` returns an array, `sdk.lomkit.users.get()` an envelope with `data` and `total`, Lomkit has no `find`, and writes answer ids. `@nexdk/repository` puts one interface on top, so the code that uses a resource does not change when the backend does.

It has no runtime dependency. `nexdk` is a peer, and each driver is an optional peer: an adapter only imports its types.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/repository`).

Once published, install the package, the drivers you use and `@nexdk/http`:

```bash
pnpm add nexdk @nexdk/http @nexdk/repository @nexdk/driver-pocketbase
```

## Interface

```ts
interface Repository<T, Id = string | number, Params = Record<string, unknown>> {
  list(options?: { page?: number; perPage?: number; params?: Params }): Promise<Page<T>>
  find(id: Id): Promise<T>
  create(input: Partial<T>): Promise<T>
  update(id: Id, patch: Partial<T>): Promise<T>
  remove(id: Id): Promise<void>
}

interface Page<T> {
  items: T[]
  total: number | null
  page: number
  perPage: number
}
```

`page` defaults to 1 and `perPage` to 20 (`DEFAULT_PER_PAGE`); anything that is not a positive integer throws a `RangeError`. `items` is a plain array. `total` is the number of records the backend says match, or `null` when it does not say. When `total` is `null`, a page with `items.length === perPage` may or may not be the last one.

## Adapters

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

const page = await repository.list({ page: 2, perPage: 10, params: { filter: 'age>30', sort: '-age' } })
page.items
page.total
```

Changing the backend changes the line that builds the repository, and `params`.

| Adapter | Driver API | `total` comes from | Paging sent as | `params` |
|---------|------------|--------------------|----------------|----------|
| `lomkitRepository(api, { key? })` | `sdk.lomkit.x` | `total` at the root of the answer | `search.page`, `search.limit` | a Lomkit payload (`{ search: { filters, sorts, ... } }`) |
| `pocketbaseRepository(api)` | `sdk.pocketbase.x` | `totalItems` | `page`, `perPage` | `filter`, `sort`, `expand`, `fields`, `skipTotal` |
| `strapiRepository(api)` | `sdk.strapi.x` | `meta.pagination.total` | `pagination[page]`, `pagination[pageSize]` | `filters`, `sort`, `populate`, `fields`, `locale` |
| `symfonyRepository(api, { paging? })` | `sdk.symfony.x` | `totalItems` of the Hydra collection | `page`, `itemsPerPage` | any query parameter |
| `nestRepository(api, { paging? })` | `sdk.nest.x` | never: `null` | `page`, `limit` | any query parameter |

The page and size you pass always win over the same keys in `params`. For Nest and Symfony, `paging: (page, perPage) => ({ ... })` replaces the names of the paging parameters when the controller uses others (`skip` and `take`, for example). Nest needs an array answer: a controller that wraps its list in `{ items, total }` is out of scope.

PocketBase's `skipTotal` makes `total` `null`. A Strapi answer without `meta.pagination` does too.

### Lomkit

Lomkit has no `find` and its writes answer ids, so the adapter does what you would do by hand: `find` is a search on `key` (default `id`) with `limit: 1`, `create` and `update` mutate then read the record back. That is two requests, as with the driver alone. Validation errors of `mutate` come back keyed `mutate.0.attributes.name`; the adapter rewrites them to `name`.

### With dialectr

[dialectr](/nexdk/guides/ecosystem/#dialectr) builds the `params`:

```ts
import { query } from 'dialectr'
import { toPocketbase } from 'dialectr-adapter-pocketbase'

const { filter, sort } = toPocketbase(query().where('age', '>', 30).sort('age', 'desc').build())

await repository.list({ params: { filter, sort } })
```

The adapters take native parameters on purpose: the package does not depend on dialectr, and a filter language common to every backend is dialectr's job, not this package's.

## Errors

The repository throws what nexdk already throws: an `SdkError` with `status`, `errors` (`{ field: [message] }`) and `data`. There is no second error class.

- A missing record is `status` 404 on every backend (Lomkit: the search is empty).
- A validation failure carries `errors` keyed by field name: Laravel `errors`, PocketBase `data`, Strapi `details.errors`, Symfony `violations` and Nest class-validator messages are all normalised by [`@nexdk/http`](/nexdk/packages/http/).
- A network failure or a timeout has `status` 0.

## Backends not covered

- **Supabase**: the driver's `get` only does equality filters, with no range or count, so there is no page to normalise.
- **Firebase**: Firestore pages by token (`nextPageToken`), without page numbers or a total.
- **Nhost**: GraphQL. The queries are yours, so there is no common shape.

Each of them can get an adapter once its driver exposes pages.

## Conformance tests

`packages/repository/test/conformance.ts` exports `defineConformance(target)`, a suite that every adapter must pass: default page, page size, disjoint pages, short last page, empty page past the end, exact or `null` total, `RangeError` on a bad page, `find`, 404 on a missing id for `find` and `update`, create, update and remove, and validation errors keyed by field. It runs here against a fake `fetch` per backend (`test/conformance.test.ts`), which is fast and says that the adapters and the driver contract agree, not that the real servers behave that way.

To run it against a real backend, add a target:

```ts
defineConformance({
  name: 'pocketbase, real server',
  total: 'exact',
  count: 45,
  missingId: 'unknownrecord01',
  open: async () => ({ repository: pocketbaseRepository(sdk.pocketbase.users), close: stopServer }),
})
```

The backend must hold `count` users (`name`, `email`, `age`) and reject a `name` shorter than two characters.
