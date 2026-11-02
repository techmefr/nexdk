# AGENT.md — @nexdk/http

## Role
Shared REST toolkit for `defineDriver`-based drivers: `request<T>(url, init?)` (JSON request over `ofetch`, `init.fetch` optional), `createRequest(fetch?)`, `HttpError` (an `SdkError`: `status`, `data`, `errors`), `toQuery`, `splitId`, `encodeId`, plus `resolveHeaders` and `HeadersResolver` re-exported from `nexdk`.

## Dependency rule
- `ofetch`: real `dependency`.
- `nexdk`: `peerDependency` (`>=0.0.1 <1`) + devDependency `workspace:*`.

## Behaviour notes
- `request` sets `retry: 0`: one driver call is one request and one `request`/`success`/`error` sequence.
- A non-2xx response or a network failure throws `HttpError`, a subclass of `SdkError` from `nexdk`. `data` is the parsed body, `errors` is `data.errors` when `data` is an object that has it, else the PocketBase `data.data` map flattened to `{ field: [message] }` (only when it is non-empty and every entry has a string `message`), `message` is `data.message` when it is a non-empty string else `HTTP {status}`, `status` is 0 for a network failure.
- `request` honours `init.fetch` by building an ofetch client with `createFetch({ fetch })` (ofetch ignores a per-call `fetch` option). `createRequest(fetch)` returns a `request` bound to that `fetch`; without a `fetch` it returns `request` (global fetch, resolved at call time).
- `toQuery` skips `undefined` and `null`, repeats the key for arrays, JSON-encodes other objects, returns `''` when empty.
- `splitId` splits `{ id, ...rest }` into `{ id, body }`.
- `encodeId` URL-encodes an id and throws on an empty id, `.` and `..`. Drivers also `encodeURIComponent` the resource name.
- Used by nest, symfony, pocketbase, strapi, firebase (all), lomkit (`createRequest`, `resolveHeaders` only). nhost and supabase do not use it.

## Error shapes and options
- `HttpError.message` is the first usable backend message (`message` string or array joined by `, `, `detail`, `error.message`, `error.details`, string `error`, `title`), else `HTTP {status}`. `errors` is normalized to `Record<string, string[]>` from `errors`, API Platform `violations`, Strapi `error.details.errors` or the PocketBase `data` map, else `undefined`. `data` is the raw body. `toErrorPayload` no longer falls back to `data` for an `SdkError`, so the thrown error and the `error` event carry the same `status` and `errors`.
- `timeout` and `signal` are optional on `request` and `createRequest(fetch, { timeout, signal })`; an abort is an `HttpError` with status 0.
- `toQuery` encodes a space as `%20`. `encodeResource(name)` applies the `encodeId` guard to resource names.

## Build/test
`pnpm --filter @nexdk/http build` · `... test`. Tests stub the global `fetch` and inject one through `init.fetch`.

## FetchLike and Nest validation
- `FetchLike` (`(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`) is defined in `nexdk` and re-exported. `HttpRequestInit.fetch` and `createRequest` take it; the one cast to `typeof fetch` is inside `request` (ofetch types). Do not widen driver options back to `typeof fetch`: bun-types' `fetch` has `preconnect`, shamock's `mock.fetch` has not. `test/fetch-like.test-d.ts` guards it.
- `errorsFromData` maps a Nest `ValidationPipe` body (`statusCode` number, `error` string, `message` string array) to `errors`: `<property> must|should|has|is|contains|cannot|does ...` keyed by the property (lowercase start, dotted allowed), `each value in <p> ...` and `property <p> should not exist` too, anything else under `_`. Tested in `test/error-data.test.ts`.
