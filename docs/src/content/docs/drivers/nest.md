---
title: '@nexdk/driver-nest'
description: Conventional REST CRUD driver for a common NestJS controller shape.
---

Conventional REST CRUD driver (common NestJS controller shape). **This is the reference driver** — the worked example for [Writing a driver](/nexdk/guides/writing-a-driver/), built with `defineDriver`.

## Install

```bash
pnpm add nexdk @nexdk/driver-nest
```

## Config

```ts
import { createNestDriver } from '@nexdk/driver-nest'

const nest = createNestDriver({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: 'Bearer …' }, // or a resolver
})
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?, mock?)` | `GET /{resource}` | Query params from `query`. Returns `T[]`. |
| `find({ id }, onEvent?, mock?)` | `GET /{resource}/{id}` | Returns `T`. |
| `create(body, onEvent?, mock?)` | `POST /{resource}` | Returns the created `T`. |
| `update({ id, ...fields }, onEvent?, mock?)` | `PATCH /{resource}/{id}` | Returns the updated `T`. |
| `remove({ id }, onEvent?)` | `DELETE /{resource}/{id}` | Returns `{ success: boolean }`. |

Uses [`@nexdk/http`](/nexdk/packages/http/)'s `request`/`toQuery`/`splitId`/`resolveHeaders` — plain `application/json` bodies throughout.
