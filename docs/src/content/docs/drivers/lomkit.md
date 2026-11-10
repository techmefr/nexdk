---
title: '@nexdk/driver-lomkit'
description: REST driver for Laravel + Lomkit REST API.
---

REST driver for a Laravel backend using the [Lomkit](https://github.com/lomkit/laravel-rest-api) search, mutate and delete conventions. Hand-written (it does not use `defineDriver`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/lomkit`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http @nexdk/driver-lomkit
```

## Config

```ts
import { createSdk, defineResource } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { z } from 'zod'

const user = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const sdk = createSdk({
  drivers: {
    lomkit: new LomkitDriver({
      baseUrl: 'https://api.example.com',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
  resources: { lomkit: { users: user } },
})
```

`headers` is a record or a resolver, evaluated before every request.

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type, exported by `nexdk` and `@nexdk/http`) and every HTTP request goes through it instead of `globalThis.fetch`, for example `mock.fetch` from shamock or the `fetch` of bun-types, without a cast.

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(payload?, onEvent?)` | `POST /{resource}/search` | The payload is the body. Returns the Laravel page: `{ data: T[], current_page, last_page, per_page, total, from, to, meta }`. |
| `mutate(payload?, onEvent?)` | `POST /{resource}/mutate` | Sends `{ mutate: [payload] }`, or `{ mutate: payload }` when `payload` is an array. Returns `{ created: key[], updated: key[] }`. |
| `delete({ resources }, onEvent?)` | `DELETE /{resource}` | Sends `{ resources: [...] }`. Returns the deleted rows the server answers, `{ data, meta }` (`LomkitDeleteResult<T>`). |
| `restore({ resources }, onEvent?)` | `POST /{resource}/restore` | Needs `withSoftDeletes()` on the Laravel route. Returns `{ data: T[], meta }`, the restored rows. |
| `forceDelete({ resources }, onEvent?)` | `DELETE /{resource}/force` | Same route rule. Removes live and trashed rows for good. Returns `{ data: T[], meta }`. |
| `actions({ name, ...body }, onEvent?)` | `POST /{resource}/actions/{name}` | `body` is `search`, `resources` or `fields` depending on the action. Returns `{ data: { impacted } }`. |
| `details(undefined, onEvent?)` | `GET /{resource}` | The resource description: `actions`, `instructions`, `fields`, `limits`, `scopes`, `relations`, `rules`. |

The URL uses the `name` of the bound resource, URL-encoded, or the call key when no resource is bound.

`get` returns one page; the pagination fields (`current_page`, `last_page`, `per_page`, `total`) are at the root of the result. It does not follow pages: set `search.page` and `search.limit` yourself. Laravel sends `meta` as `[]` when it is empty, so `result.meta?.gates` is safe to read.

```ts
const { data: page, error } = await sdk.lomkit.users.get({
  search: { filters: [{ field: 'name', operator: 'like', value: 'A%' }], limit: 20, page: 1 },
})
```

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build this payload with `toLomkit`.

## Search payload

`search` is typed (`LomkitSearch<T>`): `text` (`{ value, trashed }`), `filters` (with `nested`, `type`), `sorts`, `selects`, `scopes` (`{ name, parameters }`), `aggregates` (`{ relation, type, field, alias, filters }`), `includes` (each one a nested search with `relation` and `alias`), `instructions` (`{ name, fields: [{ name, value }] }`), `gates`, `limit` and `page`. Sort directions and gate names are checked. Operators and aggregate types autocomplete but accept any string, so the output of dialectr fits.

Aggregates and includes add keys to each row. Declare them with the generic of `get`:

```ts
const { data: page, error } = await sdk.lomkit.users.get<{ posts_count: number }>({
  search: { aggregates: [{ relation: 'posts', type: 'count' }] },
})
if (!error) page.data[0].posts_count
```

## Gates

Ask for gates inside `search`. The backend answers one `gates` object per row, and the `create` gate in `meta.gates`.

```ts
import { isGateAllowed } from '@nexdk/driver-lomkit'

const { data: page } = await sdk.lomkit.posts.get({ search: { gates: ['create', 'update', 'delete'] } })
page?.meta?.gates?.authorized_to_create
isGateAllowed(page?.data[0].gates?.authorized_to_update)
```

Names are Lomkit's defaults (`authorized_to_view`, `authorized_to_create`, `authorized_to_update`, `authorized_to_delete`, `authorized_to_restore`, `authorized_to_force_delete`). A gate is a boolean, or `{ allowed, message }` when the backend enables gate messages: `isGateAllowed` reads both. Custom names or a custom `gates` key are not known to the types: the index signature of `LomkitGates` accepts them.

## Mutate relations

`relations` is typed by operation. A single relation (belongsTo, hasOne) takes one operation, a multiple one takes a list. Relations nest.

```ts
await sdk.lomkit.users.mutate({
  operation: 'create',
  attributes: { name: 'Alice' },
  relations: {
    manager: { operation: 'attach', key: 1 },
    posts: [
      { operation: 'create', attributes: { title: 'First' } },
      { operation: 'update', key: 3, attributes: { title: 'Renamed' } },
    ],
    roles: { operation: 'sync', key: [1, 2], without_detaching: true, pivot: { level: 1 } },
  },
})
```

| Operation | Needs | Not allowed |
|-----------|-------|-------------|
| `create` | | `key` |
| `update` | `key` | |
| `attach` | `key` | `attributes` |
| `detach` | `key` | `attributes`, `pivot` |
| `toggle` | `key` | `without_detaching` |
| `sync` | `key` | |

`key` is an id or a list of ids. `pivot` is for many-to-many relations.

## Errors

A failure emits `error`, then gives the `HttpError` from [`@nexdk/http`](/nexdk/packages/http/), a typed `SdkError` with `status`, `errors` and `data`.

- On a 422, the message is the Laravel `message`, `errors` is the field map and `data` is the raw body.
- The driver turns Laravel's paths into simple field names, on the thrown error and on the `error` event: `mutate.0.attributes.email` becomes `email`, `search.limit` becomes `limit`, `mutate.0.relations.posts.1.attributes.title` becomes `posts.1.title`. Messages of keys that end up with the same name are merged. Other keys (`resources.0`, `fields.role`) are kept. `data.errors` keeps the original keys.
- The `error` event carries `{ message, status, errors }`. When the body has no `errors` key, `errors` is the raw response body.
- A network failure has `status` 0.

```ts
import { SdkError } from 'nexdk'

const { error } = await sdk.lomkit.users.mutate({ operation: 'create', attributes: { email: '' } })
if (error instanceof SdkError && error.status === 422) console.log(error.errors)
```

To react to a status for the whole app (401 logout, 403 redirect), see [React to statuses](/nexdk/guides/react-to-statuses/).
