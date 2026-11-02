---
title: Ecosystem
description: beepr, shamock and dialectr, and how to combine them with nexdk.
---

nexdk has no dependency on the projects below. Each one works alone; they meet in your application code.

None of them is published to npm yet. Clone the repository and build it.

| Project | Role |
|---------|------|
| [neXdk](https://github.com/techmefr/nexdk) | One resource grammar for REST, GraphQL and WebSocket backends. |
| [beepr](https://github.com/techmefr/beepr) | Typed notifications and debug output. |
| [shamock](https://github.com/techmefr/shamock) | Mock `fetch` without any dependency. |
| [dialectr](https://github.com/techmefr/dialectr) | Universal query builder with lomkit, PocketBase and Strapi adapters. |

## beepr

`createNotify` turns a typed adapter into the `(event, data) => void` handler that `createSdk` expects as `notify`. Sensitive keys are redacted by default.

```ts
import { createSdk } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { createNotify } from 'beepr'

const sdk = createSdk({
  drivers: { lomkit: new LomkitDriver({ baseUrl: 'https://api.example.com' }) },
  notify: createNotify({
    onRequest: ({ resource }) => console.log('request', resource),
    onSuccess: () => console.log('success'),
    onError: ({ message }) => console.error(message),
  }),
})
```

beepr also has `createDebug` (trace, state and diagnostic channels). It stays silent unless the current environment is listed, and it refuses production-like names.

## shamock

shamock serves a lomkit-shaped API (`POST /{resource}/search`, `POST /{resource}/mutate`, `DELETE /{resource}`) from seed data, with no dependency. `installMock` replaces the global `fetch`, which the REST drivers and nhost call. Call `restore()` when you are done.

```ts
import { createSdk } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { installMock } from 'shamock'

const mock = await installMock({
  baseUrl: 'https://api.example.com',
  seed: { users: [{ id: 1, name: 'Ada', age: 36 }, { id: 2, name: 'Bob', age: 12 }] },
  timing: 0,
})

const sdk = createSdk({
  drivers: { lomkit: new LomkitDriver({ baseUrl: 'https://api.example.com' }) },
})

const { data } = await sdk.lomkit.users.get({ search: { filters: [{ field: 'age', operator: '>=', value: 18 }] } })

mock.restore()
```

Use `createMock` instead when you want to keep the global `fetch` untouched: its `mock.fetch` is a drop-in `fetch` to hand to any client that accepts one. The nexdk drivers do not take a `fetch` option, so use `installMock` with them.

## dialectr

dialectr builds one neutral query and compiles it to a backend dialect. The output of an adapter is the payload of the matching nexdk driver.

```ts
import { createSdk } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'

const adults = query<{ name: string; age: number }>()
  .where('age', '>=', 18)
  .sort('name')
  .limit(10)
  .build()

const sdk = createSdk({
  drivers: { lomkit: new LomkitDriver({ baseUrl: 'https://api.example.com' }) },
})

const { data } = await sdk.lomkit.users.get(toLomkit(adults))
```

`toLomkit(adults)` returns:

```json
{
  "search": {
    "filters": [{ "field": "age", "operator": ">=", "value": 18 }],
    "sorts": [{ "field": "name", "direction": "asc" }],
    "limit": 10
  }
}
```

The other adapters feed the other drivers the same way:

| Adapter | Output | Driver call |
|---------|--------|-------------|
| `toLomkit` | `{ search: { ... } }` | `sdk.lomkit.users.get(payload)` |
| `toPocketbase` | `{ filter, sort, perPage }` | `sdk.pocketbase.users.get(payload)` |
| `toStrapi` | `{ filters, sort, pagination }` | `sdk.strapi.users.get(payload)` |

Setting `limit` in dialectr makes PocketBase and Strapi return that single page, because the driver only follows every page when you do not set one.

## All three

The pieces are independent, so they stack: the mock answers, dialectr writes the query, beepr listens.

```ts
import { createSdk } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { createNotify } from 'beepr'
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'
import { installMock } from 'shamock'

const mock = await installMock({
  baseUrl: 'https://api.example.com',
  seed: { users: [{ id: 1, name: 'Ada', age: 36 }] },
  timing: 0,
})

const sdk = createSdk({
  drivers: { lomkit: new LomkitDriver({ baseUrl: 'https://api.example.com' }) },
  notify: createNotify({
    onRequest: ({ resource }) => console.log('request', resource),
    onSuccess: () => console.log('success'),
  }),
})

const adults = query<{ name: string; age: number }>().where('age', '>=', 18).build()
const { data } = await sdk.lomkit.users.get(toLomkit(adults))

mock.restore()
```
