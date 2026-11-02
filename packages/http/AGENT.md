# AGENT.md — @nexdk/http

## Role
Shared REST toolkit for `defineDriver`-based drivers: `request<T>(url, init?)` (JSON request over `ofetch`), `HttpError` (`status`, `data`), `toQuery`, `splitId`, `encodeId`, plus `resolveHeaders` and `HeadersResolver` re-exported from `nexdk`.

## Dependency rule
- `ofetch`: real `dependency`.
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`).

## Behaviour notes
- `request` sets `retry: 0`: one driver call is one request and one `request`/`success`/`error` sequence.
- A non-2xx response or a network failure throws `HttpError`. `data` is the parsed body, `status` is 0 for a network failure.
- `toQuery` skips `undefined` and `null`, repeats the key for arrays, JSON-encodes other objects, returns `''` when empty.
- `splitId` splits `{ id, ...rest }` into `{ id, body }`.
- `encodeId` URL-encodes an id and throws on an empty id, `.` and `..`. Drivers also `encodeURIComponent` the resource name.
- Used by nest, symfony, pocketbase, strapi, firebase (all), lomkit (`request`, `HttpError`, `resolveHeaders` only). nhost and supabase do not use it.

## Build/test
`pnpm --filter @nexdk/http build` · `... test`. Tests mock `fetch`.
