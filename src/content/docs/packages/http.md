---
title: '@nexdk/http'
description: Shared REST toolkit for defineDriver-based drivers, built on ofetch.
---

Shared REST toolkit for `defineDriver`-based drivers: a JSON `request` over [`ofetch`](https://github.com/unjs/ofetch), a headers resolver, and small query-string/id-splitting helpers. Extracted from the near-identical code that `@nexdk/driver-nest` and `@nexdk/driver-symfony` each hand-rolled.

This package is optional — a driver author who doesn't want `ofetch` simply doesn't depend on it and rolls their own `fetch`, the way `@nexdk/driver-lomkit` and `@nexdk/driver-supabase` still do.

## Install

```bash
pnpm add nexdk @nexdk/http
```

## API

```ts
import { HttpError, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
```

- **`request<T>(url, init?)`** — JSON request over `ofetch`. `init` accepts `{ method?, headers?, body? }`. Throws `HttpError` on any non-2xx response or network failure. Explicitly disables `ofetch`'s default retry-once-on-5xx behaviour (`retry: 0`) — the unified driver contract emits one `request`/`success`/`error` per call, so a silent retry would break that.
- **`HttpError`** — `{ status: number, data: unknown, message: string }`. `data` is the parsed response body, if any (a driver with a richer error shape, e.g. lomkit's 422 validation payload, reads it from here).
- **`toQuery(payload)`** — serializes a plain object into a `?a=1&b=2` query string (`''` when empty/undefined).
- **`splitId(payload)`** — splits `{ id, ...rest }` into `{ id, body: rest }`, for the id-in-URL REST shape (`PATCH /{resource}/{id}` with the rest as the body).
- **`resolveHeaders`** / **`HeadersResolver`** — re-exported from `nexdk`, so a REST driver only needs one import.

```ts
const { id, body } = splitId({ id: 1, name: 'Alice' })
// id: 1, body: { name: 'Alice' }

await request(`https://api.example.com/users${toQuery({ page: 1 })}`, {
  method: 'PATCH',
  headers: await resolveHeaders(config.headers),
  body,
})
```

## Who uses it

[`@nexdk/driver-nest`](/nexdk/drivers/nest/) and [`@nexdk/driver-symfony`](/nexdk/drivers/symfony/) use all of `request`/`toQuery`/`splitId`/`resolveHeaders`. [`@nexdk/driver-lomkit`](/nexdk/drivers/lomkit/) uses `request`/`resolveHeaders`/`HttpError` (catching `HttpError` itself to special-case its 422 validation body) but not `toQuery`/`splitId` — its `/search`/`/mutate` endpoints don't have the id-in-URL shape those two assume. `@nexdk/driver-nhost` and `@nexdk/driver-supabase` don't use it at all (GraphQL and the Supabase SDK have their own transports).
