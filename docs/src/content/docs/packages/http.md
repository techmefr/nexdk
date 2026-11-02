---
title: '@nexdk/http'
description: Shared REST toolkit for defineDriver-based drivers, built on ofetch.
---

REST helpers shared by the `defineDriver`-based drivers: a JSON `request` over [ofetch](https://github.com/unjs/ofetch), `HttpError`, and small query-string and id helpers.

The package is optional. A driver that does not want `ofetch` can use `fetch` directly, as nhost does (supabase goes through supabase-js).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/http`).

## API

```ts
import { HttpError, createRequest, encodeId, request, resolveHeaders, splitId, toQuery } from '@nexdk/http'
```

- **`request<T>(url, init?)`**: JSON request. `init` is `{ method?, headers?, body?, fetch? }`. `fetch` replaces `globalThis.fetch` for that call. Throws `HttpError` on a non-2xx response or a network failure. Retries are disabled (`retry: 0`), so one call is one request.
- **`createRequest(fetch?)`**: returns a `request` bound to the given `fetch`. Without an argument it returns `request`. The REST drivers call it with their `fetch` config option.
- **`HttpError`**: a subclass of `SdkError` from `nexdk`: `{ status, data, errors, message }`. `data` is the parsed response body. `errors` is its `errors` key, when it is an object that has one (Laravel validation). `message` is the body `message` when it is a non-empty string, else `HTTP {status}`. Network failures have `status` 0 and the network error message.
- **`toQuery(payload)`**: object to `?a=1&b=2`. `undefined` and `null` values are skipped, arrays repeat the key, other objects are JSON-encoded. Returns `''` when empty.
- **`splitId(payload)`**: `{ id, ...rest }` to `{ id, body: rest }`.
- **`encodeId(id)`**: URL-encodes an id. Throws on an empty id, `.` or `..`.
- **`resolveHeaders`**, **`HeadersResolver`**: re-exported from `nexdk`.

```ts
import { HttpError, encodeId, request, splitId, toQuery } from '@nexdk/http'

const { id, body } = splitId({ id: 1, name: 'Alice' })

await request(`https://api.example.com/users/${encodeId(id)}${toQuery({ notify: true })}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body,
})

try {
  await request('https://api.example.com/missing')
} catch (error) {
  if (error instanceof HttpError) console.log(error.status, error.data)
}
```

## Who uses it

nest, symfony, pocketbase, strapi and firebase use `createRequest`, `encodeId`, `resolveHeaders` and, depending on the driver, `toQuery` and `splitId`. lomkit uses `createRequest`, `HttpError` and `resolveHeaders`. nhost and supabase do not use it.
