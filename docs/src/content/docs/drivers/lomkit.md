---
title: '@nexdk/driver-lomkit'
description: REST driver for Laravel + Lomkit REST API.
---

REST driver for a Laravel backend using the [Lomkit](https://github.com/lomkit/laravel-rest-api) search, mutate and delete conventions. Hand-written (it does not use `defineDriver`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/lomkit`).

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

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(payload?, onEvent?)` | `POST /{resource}/search` | The payload is the body. Returns `{ data: T[], meta? }`. |
| `mutate(payload?, onEvent?)` | `POST /{resource}/mutate` | Sends `{ mutate: [payload] }`. Returns `{ data: T[] }`. |
| `delete({ resources }, onEvent?)` | `DELETE /{resource}` | Sends `{ resources: [...] }`. Returns `{ success: true }`. |

The URL uses the `name` of the bound resource, URL-encoded, or the call key when no resource is bound.

`get` returns one page and its `meta` (`current_page`, `last_page`, `per_page`, `total`). It does not follow pages: set `search.page` and `search.limit` yourself.

```ts
const { data, meta } = await sdk.lomkit.users.get({
  search: { filters: [{ field: 'name', operator: 'like', value: 'A%' }], limit: 20, page: 1 },
})
```

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build this payload with `toLomkit`.

## Errors

A failure emits `error`, then throws a plain `Error`.

- On a 422, the `error` event carries `{ message, errors }`, the Laravel validation payload.
- On any other failure, the event carries `{ message }` (for example `HTTP 500`). There is no `status`.

```ts
await sdk.lomkit.users.mutate({ operation: 'create', attributes: {} }, (event, data) => {
  if (event === 'error') console.error(data)
})
```

The thrown error only has the message. Read field errors from the event.
