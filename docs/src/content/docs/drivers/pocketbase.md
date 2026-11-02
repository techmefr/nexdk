---
title: '@nexdk/driver-pocketbase'
description: PocketBase records API driver with filter, sort and pagination.
---

REST driver for the [PocketBase](https://pocketbase.io) records API (`/api/collections/{collection}/records`). Built with `defineDriver` on [`@nexdk/http`](/nexdk/packages/http/).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/pocketbase`). It peer-depends on `nexdk` and `@nexdk/http`.

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http @nexdk/driver-pocketbase
```

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

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type, exported by `nexdk` and `@nexdk/http`) and every HTTP request goes through it instead of `globalThis.fetch`, for example `mock.fetch` from shamock or the `fetch` of bun-types, without a cast.



The resource name is the collection name.

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET …/records` | `query` accepts `page`, `perPage`, `sort`, `filter`, `expand`, `fields`. Returns the `items` as `T[]`. |
| `find({ id }, onEvent?)` | `GET …/records/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/records` | Returns the created `T`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/records/{id}` | Returns the updated `T`. |
| `remove({ id }, onEvent?)` | `DELETE …/records/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every page and returns all the items. If you set `page` or `perPage`, it makes one request and returns that page only. `get({ page: 2 })` without `perPage` is therefore one page of the PocketBase default size (30), not the rest of the records: you fixed the page, so nexdk does not go on.

```ts
const second = await sdk.pocketbase.posts.get({ page: 2, perPage: 20 })
```

With `skipTotal`, PocketBase answers `totalPages: -1`. `get` then asks for the next page as long as the previous one was full (`perPage` of the response) and stops on a short or empty page, so no record is dropped.

```ts
const all = await sdk.pocketbase.posts.get({ skipTotal: true })
```

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build the query with `toPocketbase`. It sets `perPage` when you call `limit()`.

## Errors

The collection name and the id are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`.

A validation failure answers `{ status, message, data: { field: { code, message } } }`. nexdk maps it to `errors: { field: [message] }`, on the thrown error and in the `error` event; the raw body stays in `error.data`.

```ts
import { SdkError } from 'nexdk'

try {
  await sdk.pocketbase.users.create({ email: 'a@b.test' })
} catch (error) {
  if (error instanceof SdkError) console.log(error.errors)
}
```

An invalid query (unknown filter field, unknown sort field, malformed filter) is answered by PocketBase with a generic 400 that names no clause. nexdk reports it as `PocketBase rejected the request: <server message>` with `status` 400, and adds nothing else.

## Collection names

A fresh PocketBase ships an auth collection named `users`. A resource named `users` talks to that collection: delete or rename it, or use another resource name, if you want your own base collection.

## Totals

The array returned by `get` carries a non-enumerable `pagination` property, as the Symfony and Firebase drivers do: `{ page, perPage, totalItems, totalPages }`, read from the page answer (the first page when `get` follows every page). With `skipTotal`, PocketBase answers `-1`: `totalItems` and `totalPages` are then `undefined`. It does not show up in `Object.keys`, `JSON.stringify` or `toEqual`.

```ts
const rows = await sdk.pocketbase.posts.get({ page: 2, perPage: 20 })
rows.pagination?.totalItems
```
