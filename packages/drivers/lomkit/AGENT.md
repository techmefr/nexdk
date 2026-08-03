# AGENT.md — @nexdk/driver-lomkit

## Role
REST driver for Laravel + Lomkit REST API. `get` → POST `/{resource}/search`,
`mutate` → POST `/{resource}/mutate`, `delete` → DELETE `/{resource}` with
`{ resources: [...] }`. Exposes `LomkitDriver`.

## Dependency rule
- `nexdk`: **peerDependency** (+ devDependency `workspace:*`) — type-only usage.
- `chaff`: real `dependency` — used at runtime (`parseMockList`) for the `mock` param.
- `@nexdk/http`: real `dependency` — `request`/`HttpError`/`resolveHeaders`.
  Not `toQuery`/`splitId` (lomkit's `/search`/`/mutate` endpoints don't have the
  id-in-URL shape those two assume).
- Event type imported from `nexdk` (`import type`), never from beepr.

## Contract
Emit `'error'` then `throw` on network / non-2xx HTTP / 422. `headers` may be a
`Record` or a `() => Record | Promise<Record>` resolver (per-request, for token
refresh). `handleError` reads the 422 body from `HttpError.data`.

## Build/test
`pnpm --filter @nexdk/driver-lomkit build` · `... test`. Tests mock `fetch`.
