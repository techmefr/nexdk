---
title: '@nexdk/driver-symfony'
description: REST driver for Symfony / API Platform (Hydra, merge-patch).
---

API Platform (Symfony) REST driver over the Hydra / JSON-LD conventions. Built with `defineDriver`.

## Install

```bash
pnpm add nexdk @nexdk/driver-symfony
```

## Config

```ts
import { createSymfonyDriver } from '@nexdk/driver-symfony'

const symfony = createSymfonyDriver({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: 'Bearer …' }, // or a resolver
})
```

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /{resource}` | Unwraps `body['hydra:member']`, falling back to `body.member`, then the body itself. |
| `find({ id }, onEvent?)` | `GET /{resource}/{id}` | Returns a single JSON-LD record. |
| `create(body, onEvent?)` | `POST /{resource}` | Sends `Content-Type: application/ld+json`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH /{resource}/{id}` | Sends `Content-Type: application/merge-patch+json` — API Platform requires this. |
| `remove({ id }, onEvent?)` | `DELETE /{resource}/{id}` | Returns `{ success: boolean }`. |

This is the meaningful difference from [`@nexdk/driver-nest`](/nexdk/drivers/nest/), which uses plain `application/json`: API Platform's Hydra collection shape and merge-patch requirement are handled for you. Consumers can override any header via the `headers` resolver. Uses [`@nexdk/http`](/nexdk/packages/http/) for the shared REST plumbing; `unwrapCollection` (the Hydra unwrap) stays local since it's symfony-specific.
