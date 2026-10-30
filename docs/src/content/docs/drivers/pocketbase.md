---
title: '@nexdk/driver-pocketbase'
description: PocketBase records API driver with filter, sort and pagination.
---

REST driver for the [PocketBase](https://pocketbase.io) records API (`/api/collections/{collection}/records`). Built with `defineDriver` on top of [`@nexdk/http`](/nexdk/packages/http/).

## Install

```bash
pnpm add nexdk @nexdk/driver-pocketbase
```

## Config

```ts
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'

const pocketbase = createPocketbaseDriver({
  baseUrl: 'http://127.0.0.1:8090',
  headers: async () => ({ Authorization: await getToken() }),
})
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /api/collections/{resource}/records` | `query` accepts `page`, `perPage`, `sort`, `filter`, `expand`, `fields`. Returns the `items` array as `T[]`. |
| `find({ id }, onEvent?)` | `GET …/records/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/records` | Returns the created `T`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/records/{id}` | Returns the updated `T`. |
| `remove({ id }, onEvent?)` | `DELETE …/records/{id}` | Returns `{ success: boolean }`. |

Ids are URL-encoded. The resource name is the PocketBase collection name.
