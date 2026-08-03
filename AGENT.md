# AGENT.md — @pilota/http

## Role
Shared REST toolkit for `defineDriver`-based drivers: `request<T>(url, init?)`
(JSON request over `ofetch`, throws `HttpError` on non-2xx), `HttpError`
(`status`, `data`), `toQuery`/`splitId` (query-string and id/body splitting),
plus `resolveHeaders`/`HeadersResolver` re-exported from `nexdk`. Extracted from
the near-identical `request`/`toQuery`/`splitId` that `nest` and `symfony` each
hand-rolled.

## Dependency rule
- `ofetch`: real **dependency** — this package genuinely owns it at runtime.
- `nexdk`: **peerDependency** (+ devDependency `workspace:*`) — re-exports
  `resolveHeaders`/`HeadersResolver` so REST drivers only need one import.

## Behaviour notes
- `request` sets `retry: 0` explicitly. ofetch retries idempotent methods once
  by default on a 5xx/network failure — disabled here because the unified
  driver contract emits one `request`/`success`/`error` per call; a silent
  extra network attempt would break that assumption.
- `HttpError.data` is the parsed response body (if any) — a driver with a
  richer error shape (e.g. lomkit's 422 validation payload) reads it from
  there rather than re-parsing the response itself.
- Not every helper fits every driver. lomkit uses `request`/`resolveHeaders`/
  `HttpError` (catching `HttpError` itself to special-case its 422 validation
  body) but not `toQuery`/`splitId` — its `/search`/`/mutate` endpoints don't
  have the id-in-URL REST shape those two were extracted for. Use what fits;
  don't force a driver onto a helper it doesn't need.

## Build/test
`pnpm --filter @pilota/http build` · `... test`. Tests mock `fetch`.
