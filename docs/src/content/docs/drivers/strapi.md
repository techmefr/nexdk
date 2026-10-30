---
title: '@nexdk/driver-strapi'
description: Strapi REST driver that unwraps the data envelope and builds bracket query strings.
---

REST driver for [Strapi](https://strapi.io) (v5 flat documents). Strapi wraps every response in `{ data, meta }` and expects `{ data }` on writes: the driver handles both, and serializes nested query objects into Strapi's bracket notation (`filters[title][$eq]=…`).

## Install

```bash
pnpm add nexdk @nexdk/driver-strapi
```

## Config

```ts
import { createStrapiDriver } from '@nexdk/driver-strapi'

const strapi = createStrapiDriver({
  baseUrl: 'http://localhost:1337',
  headers: { Authorization: 'Bearer …' },
})
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /api/{resource}` | `query` accepts `filters`, `sort`, `populate`, `fields`, `pagination`, `locale`. Returns `data` as `T[]`. |
| `find({ id }, onEvent?)` | `GET /api/{resource}/{id}` | Use the `documentId`. Returns `T`. |
| `create(body, onEvent?)` | `POST /api/{resource}` | Body sent as `{ data: body }`. |
| `update({ id, ...fields }, onEvent?)` | `PUT /api/{resource}/{id}` | Fields sent as `{ data: fields }`. |
| `remove({ id }, onEvent?)` | `DELETE /api/{resource}/{id}` | Returns `{ success: boolean }`. |

`toStrapiQuery` is exported if you need the serializer on its own.
