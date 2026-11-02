---
title: '@nexdk/driver-symfony'
description: REST driver for Symfony / API Platform (Hydra, merge-patch).
---

API Platform (Symfony) REST driver over Hydra / JSON-LD. Built with `defineDriver`.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/symfony`).

## Config

```ts
import { createSdk } from 'nexdk'
import { createSymfonyDriver } from '@nexdk/driver-symfony'

const sdk = createSdk({
  drivers: {
    symfony: createSymfonyDriver({
      baseUrl: 'https://api.example.com',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
})

const books = await sdk.symfony.books.get({ page: 1 })
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /{resource}` | Returns `hydra:member`, else `member`, else the body. One request, no page following. |
| `find({ id }, onEvent?)` | `GET /{resource}/{id}` | Returns one record. |
| `create(body, onEvent?)` | `POST /{resource}` | `Content-Type: application/ld+json`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH /{resource}/{id}` | `Content-Type: application/merge-patch+json`, which API Platform requires. |
| `remove({ id }, onEvent?)` | `DELETE /{resource}/{id}` | Returns `{ success: boolean }`. |

Requests send `Accept: application/ld+json`. Any header can be overridden through `headers`. The resource name and the id are URL-encoded.

`fetch` is optional: pass any `fetch` implementation and every HTTP request goes through it instead of `globalThis.fetch`, for example a mock or a custom transport.

Compared with [nest](/nexdk/drivers/nest/), the differences are the Hydra unwrap and the merge-patch content type.

## Errors

A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`.
