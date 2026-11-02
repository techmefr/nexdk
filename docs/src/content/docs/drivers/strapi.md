---
title: '@nexdk/driver-strapi'
description: Strapi REST driver that unwraps the data envelope and builds bracket query strings.
---

REST driver for [Strapi](https://strapi.io) v5 (flat documents). Strapi wraps responses in `{ data, meta }` and expects `{ data }` on writes. The driver handles both and serializes nested query objects to bracket notation (`filters[title][$eq]=…`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/strapi`).

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

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /api/{resource}` | `query` accepts `filters`, `sort`, `populate`, `fields`, `pagination`, `locale`. Returns `data` as `T[]`. |
| `find({ id }, onEvent?)` | `GET /api/{resource}/{id}` | Use the `documentId`. Returns `T`. |
| `create(body, onEvent?)` | `POST /api/{resource}` | Sends `{ data: body }`. |
| `update({ id, ...fields }, onEvent?)` | `PUT /api/{resource}/{id}` | Sends `{ data: fields }`. |
| `remove({ id }, onEvent?)` | `DELETE /api/{resource}/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every page (`meta.pagination.pageCount`). If `pagination` sets `page`, `pageSize`, `start` or `limit`, it makes one request and returns that page only.

## Query serialization

`toStrapiQuery` is exported. Nested objects and arrays become bracket keys (`populate[0]=author`). `undefined` and `null` are skipped. A query nested deeper than 16 levels, or with a circular reference, throws.

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build the query with `toStrapi`.

## Errors

The resource name and the id are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`.
