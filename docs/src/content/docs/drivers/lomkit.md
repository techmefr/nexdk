---
title: '@nexdk/driver-lomkit'
description: REST driver for Laravel + Lomkit REST API.
---

REST driver for a Laravel backend using [Lomkit](https://github.com/lomkit/laravel-rest-api)'s search/mutate/delete conventions. Hand-written (predates `defineDriver`).

## Install

```bash
pnpm add nexdk @nexdk/driver-lomkit
```

## Config

```ts
import { LomkitDriver } from '@nexdk/driver-lomkit'

const lomkit = new LomkitDriver({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: 'Bearer …' }, // or a resolver: () => ({ Authorization: … })
})
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(payload?, onEvent?, mock?)` | `POST /{resource}/search` | Returns `{ data: T[], meta? }` (pagination). |
| `mutate(payload?, onEvent?, mock?)` | `POST /{resource}/mutate` | Returns `{ data: T[] }`. |
| `delete({ resources }, onEvent?)` | `DELETE /{resource}` with `{ resources: [...] }` | Returns `{ success: boolean }`. |

## Errors

- A non-2xx HTTP response, a network failure, or a 422 validation body all emit `'error'` then throw a plain `Error` — on a 422, the `'error'` event itself carries the full `{ message, errors }` (per-field messages) read from `HttpError.data` (from [`@nexdk/http`](/nexdk/packages/http/)).
- `headers` may be a static object or an async resolver, re-evaluated before every request (useful for a refreshed bearer token).

```ts
await sdk.lomkit.users.mutate({ name: 'Alice' }, (event, data) => {
  if (event === 'error') {
    // on a 422: data = { message, errors: { email: ['required'] } }
  }
})
// still throws afterward — the thrown Error only carries `message`,
// read the field-level detail from the 'error' event above.
```
