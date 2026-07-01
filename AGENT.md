# AGENT.md — @pilota/driver-lomkit

## Role
REST driver for Laravel + Lomkit REST API. `get` → POST `/{resource}/search`,
`mutate` → POST `/{resource}/mutate`, `delete` → DELETE `/{resource}` with
`{ resources: [...] }`. Exposes `LomkitDriver`.

## Dependency rule
- `nexdk`: **peerDependency** (+ devDependency `workspace:*`) — type-only usage.
- `chaff`: real `dependency` — used at runtime (`parseMockList`) for the `mock` param.
- Event type imported from `nexdk` (`import type`), never from beepr.

## Contract
Emit `'error'` then `throw` on network / non-2xx HTTP / 422. `headers` may be a
`Record` or a `() => Record | Promise<Record>` resolver (per-request, for token
refresh).

## Build/test
`pnpm --filter @pilota/driver-lomkit build` · `... test`. Tests mock `fetch`.
