---
title: '@nexdk/driver-pocketbase'
description: PocketBase records API driver with filter, sort and pagination.
---

REST driver for the [PocketBase](https://pocketbase.io) records API (`/api/collections/{collection}/records`). Built with `defineDriver` on [`@nexdk/http`](/nexdk/packages/http/).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/pocketbase`).

## Config

```ts
import { createSdk } from 'nexdk'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'

const sdk = createSdk({
  drivers: {
    pocketbase: createPocketbaseDriver({
      baseUrl: 'http://127.0.0.1:8090',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
})

const posts = await sdk.pocketbase.posts.get({ sort: '-created' })
```

## Methods

The resource name is the collection name.

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET …/records` | `query` accepts `page`, `perPage`, `sort`, `filter`, `expand`, `fields`. Returns the `items` as `T[]`. |
| `find({ id }, onEvent?)` | `GET …/records/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/records` | Returns the created `T`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/records/{id}` | Returns the updated `T`. |
| `remove({ id }, onEvent?)` | `DELETE …/records/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every page (`totalPages`) and returns all the items. If you set `page` or `perPage`, it makes one request and returns that page only.

```ts
const second = await sdk.pocketbase.posts.get({ page: 2, perPage: 20 })
```

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build the query with `toPocketbase`. It sets `perPage` when you call `limit()`.

## Errors

The collection name and the id are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`.
