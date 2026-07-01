# AGENT.md — @pilota/driver-nhost

## Role
GraphQL + subscriptions driver for Hasura/Nhost. `query`/`mutation`/`upsert`/
`updateById`/`updateWhere`/`deleteById`/`subscription`. Exposes `NhostDriver`.

## Layout
- `driver.ts` — GraphQL **document building** (values go through GraphQL
  variables, never string-interpolated — keep it that way; injection-safe).
- `connection-pool.ts` — the shared `graphql-transport-ws` WebSocket pool:
  one connection per (endpoint+secret), refCount, pending-before-ack queue,
  **reconnect with exponential backoff + resubscribe of active handlers**.
  Intentional teardown (refCount→0) must never reconnect.

## Dependency rule
- `nexdk`: **peerDependency** (+ devDependency `workspace:*`) — type-only usage.
- Event type from `nexdk`, never beepr. No other runtime dep.

## Contract
Emit `'error'` then `throw` on failure. `headers` may be a resolver (applied per
request and on every WS reconnect via `connection_init`). Subscription ids use
`crypto.randomUUID()`.

## Build/test
`pnpm --filter @pilota/driver-nhost build` · `... test`. Tests mock `fetch` and
`WebSocket` (incl. reconnect/replay with fake timers).
