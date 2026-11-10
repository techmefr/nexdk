---
title: '@nexdk/http'
description: Shared REST toolkit for defineDriver-based drivers, built on the native fetch.
---

REST helpers shared by the `defineDriver`-based drivers: a JSON `request` over the native `fetch`, `HttpError`, and small query-string and id helpers. It has no runtime dependency besides its `nexdk` peer.

The package is optional. A driver can use `fetch` directly, as nhost does (supabase goes through supabase-js).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/http`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http
```

## API

```ts
import { HttpError, createRequest, encodeId, encodeResource, request, resolveHeaders, splitId, toQuery, withCallOptions } from '@nexdk/http'
```

- **`request<T>(url, init?)`**: JSON request. `init` is `{ method?, headers?, body?, fetch?, timeout?, signal?, onResponse? }`. `fetch` is a `FetchLike` and replaces `globalThis.fetch` for that call. `timeout` (milliseconds) and `signal` (an `AbortSignal`) abort the request, together when both are set: it then throws an `HttpError` with `status` 0 and `kind` `timeout` or `abort`. Neither is set by default. `onResponse(response, { url, method })` runs on every response, success or error, before the body is parsed, and is awaited; a throw inside it becomes the error of the call. Use it to read headers or refresh a token; clone the response before reading its body. Throws `HttpError` on a non-2xx response or a network failure. There are no retries, so one call is one request.
- **`FetchLike`**: `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`, defined in `nexdk` and re-exported here. It is the type of the `fetch` option of every driver and of `request`. It is narrower than `typeof fetch`, so `mock.fetch` from shamock and the `fetch` of bun-types (which carries an extra `preconnect` member) are accepted without a cast.
- **`createRequest(fetch?, { timeout?, signal?, onResponse? }?)`**: returns a `request` bound to the given `fetch` and defaults. A per-request `timeout` or `onResponse` wins, a per-request `signal` is combined with the default one. Without an argument it returns `request`. The REST drivers call it with their `fetch`, `timeout`, `signal` and `onResponse` config options.
- **`withCallOptions(request, options)`**: applies the per-call `SdkCallOptions` (`{ signal?, timeout?, headers? }`) of a driver method to a `request`: call headers are merged over the driver headers (case-insensitive), the call timeout wins, the signals are combined. Returns `request` untouched when `options` is not an object.
- **`HttpError`**: a subclass of `SdkError` from `nexdk`: `{ status, data, errors, message }`. `data` is the parsed response body. `errors` is normalized to `Record<string, string[]>` when the body allows it: its `errors` key (Laravel; string values are wrapped in arrays), the API Platform `violations` grouped by `propertyPath` (`_` when empty), the Strapi `error.details.errors` keyed by dotted `path`, a PocketBase body `{ data: { field: { code, message } } }`, or a Nest `ValidationPipe` body `{ statusCode, message: string[], error }` (see below). Otherwise it is `undefined`: the thrown error and the `error` event always carry the same `status` and `errors`. `message` is the first usable backend message: `message` (a string, or an array joined by `, `), `detail`, `error.message`, `error.details`, a string `error`, `title`, else `HTTP {status}`. `kind` is `http` for a 4xx/5xx answer, else `timeout`, `abort` or `network` with `status` 0, the network error message and the original error as `cause`.
- **`toQuery(payload)`**: object to `?a=1&b=2`. A space is encoded as `%20`. `undefined` and `null` values are skipped, arrays repeat the key, other objects are JSON-encoded. Returns `''` when empty.
- **`splitId(payload)`**: `{ id, ...rest }` to `{ id, body: rest }`.
- **`encodeId(id)`**: URL-encodes an id. Throws on an empty id, `.` or `..`.
- **`encodeResource(name)`**: same guard for a resource name (`Invalid resource name`).
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

## Nest validation messages

A Nest `ValidationPipe` answers `{ statusCode, message: string[], error: 'Bad Request' }`. When `statusCode` is a number, `error` a string and `message` an array, each string becomes an entry of `errors`:

- `<property> must|should|has|is|contains|cannot|does ...` is keyed by the first word, if it starts with a lowercase letter and is a plain or dotted name (`email must be an email`, `address.city must be a string`).
- `each value in <property> must ...` and `property <name> should not exist` are keyed by that property.
- Anything else (a custom message such as `Email already used`) goes under `_`.

The full message is kept as the value, so `{ email: ['email must be an email'], _: ['Email already used'] }` is a possible result. The rule only reads the text: a custom message that happens to start with a lowercase word and `is` or `has` is keyed by that word. `error.data` keeps the raw body.
