---
title: '@nexdk/driver-strapi'
description: Strapi REST driver that unwraps the data envelope and builds bracket query strings.
---

REST driver for [Strapi](https://strapi.io) v5 (flat documents). Strapi wraps responses in `{ data, meta }` and expects `{ data }` on writes. The driver handles both and serializes nested query objects to bracket notation (`filters[title][$eq]=…`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/strapi`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http @nexdk/driver-strapi
```

## Config

```ts
import { createSdk } from 'nexdk'
import { createStrapiDriver } from '@nexdk/driver-strapi'

const sdk = createSdk({
  drivers: {
    strapi: createStrapiDriver({
      baseUrl: 'http://localhost:1337',
      headers: { Authorization: 'Bearer …' },
    }),
  },
})

const articles = await sdk.strapi.articles.get({
  filters: { title: { $eq: 'Hello' } },
  populate: ['author'],
})
```

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type, exported by `nexdk` and `@nexdk/http`) and every HTTP request goes through it instead of `globalThis.fetch`, for example `mock.fetch` from shamock or the `fetch` of bun-types, without a cast.



| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /api/{resource}` | `query` accepts `filters`, `sort`, `populate`, `fields`, `pagination`, `locale`. Returns `data` as `T[]`. |
| `find({ id }, onEvent?)` | `GET /api/{resource}/{id}` | Use the `documentId`. Returns `T`. |
| `create(body, onEvent?)` | `POST /api/{resource}` | Sends `{ data: body }`. |
| `update({ id, ...fields }, onEvent?)` | `PUT /api/{resource}/{id}` | Sends `{ data: fields }`. |
| `remove({ id }, onEvent?)` | `DELETE /api/{resource}/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every page (`meta.pagination.pageCount`). If `pagination` sets `page`, `pageSize`, `start` or `limit`, it makes one request and returns that page only. Strapi caps `pagination.pageSize` and `pagination.limit` at 100: a larger value is silently reduced by the server. An empty `$in` or `$notIn` list is sent as `filters[field][$in]=`, which Strapi reads as an empty list.

## Query serialization

`toStrapiQuery` is exported. Nested objects and arrays become bracket keys (`populate[0]=author`). `undefined` and `null` are skipped. A query nested deeper than 16 levels, or with a circular reference, throws.

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build the query with `toStrapi`.

## Errors

The resource name and the id are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`. The `message` is the backend message when there is one and `errors` is normalized to `{ field: [message] }` when possible (see [`@nexdk/http`](/nexdk/packages/http/)); `data` keeps the raw body. The thrown error and the event carry the same `status` and `errors`. The `timeout` (milliseconds) and `signal` (`AbortSignal`) config options abort a request with a status 0 error; neither is set by default. A resource name that is empty, `.` or `..` is refused like an id.

## Totals

The array returned by `get` carries a non-enumerable `pagination` property with `meta.pagination` as Strapi sent it (`{ page, pageSize, pageCount, total }`, or `{ start, limit, total }`), read from the page answer (the first page when `get` follows every page). It is absent when the answer has no `meta.pagination`. It does not show up in `Object.keys`, `JSON.stringify` or `toEqual`.

```ts
const rows = await sdk.strapi.articles.get({ pagination: { page: 2, pageSize: 20 } })
rows.pagination?.total
```
