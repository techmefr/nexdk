# AGENT.md — @nexdk/http

## Role
Shared REST toolkit for `defineDriver`-based drivers: `request<T>(url, init?)` (JSON request over `ofetch`, `init.fetch` optional), `createRequest(fetch?)`, `HttpError` (an `SdkError`: `status`, `data`, `errors`), `toQuery`, `splitId`, `encodeId`, plus `resolveHeaders` and `HeadersResolver` re-exported from `nexdk`.

## Dependency rule
- `ofetch`: real `dependency`.
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`).

## Behaviour notes
- `request` sets `retry: 0`: one driver call is one request and one `request`/`success`/`error` sequence.
- A non-2xx response or a network failure throws `HttpError`, a subclass of `SdkError` from `nexdk`. `data` is the parsed body, `errors` is `data.errors` when `data` is an object, `message` is `data.message` when it is a non-empty string else `HTTP {status}`, `status` is 0 for a network failure.
- `request` honours `init.fetch` by building an ofetch client with `createFetch({ fetch })` (ofetch ignores a per-call `fetch` option). `createRequest(fetch)` returns a `request` bound to that `fetch`; without a `fetch` it returns `request` (global fetch, resolved at call time).
- `toQuery` skips `undefined` and `null`, repeats the key for arrays, JSON-encodes other objects, returns `''` when empty.
- `splitId` splits `{ id, ...rest }` into `{ id, body }`.
- `encodeId` URL-encodes an id and throws on an empty id, `.` and `..`. Drivers also `encodeURIComponent` the resource name.
- Used by nest, symfony, pocketbase, strapi, firebase (all), lomkit (`createRequest`, `resolveHeaders` only). nhost and supabase do not use it.

## Build/test
`pnpm --filter @nexdk/http build` · `... test`. Tests stub the global `fetch` and inject one through `init.fetch`.
