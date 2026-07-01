# AGENT.md — @pilota/driver-nest (reference driver)

## Role
Conventional REST CRUD driver (common NestJS controller shape):
`get`/`find`/`create`/`update`/`remove` → GET/POST/PATCH/DELETE on
`/{resource}` and `/{resource}/{id}`. Exposes `createNestDriver(config)`,
`NestResourceApi<T>`, `NestConfig`.

**This is the reference driver** — it's the worked example for
[docs/writing-a-driver.md](../../../docs/writing-a-driver.md). Built WITH
`defineDriver` from `nexdk`, so it demonstrates the recommended authoring path
and the unified event contract. Keep it exemplary.

## Dependency rule
- `nexdk` is a **peerDependency** (+ devDependency `workspace:*`), never a
  `dependency`. It uses `defineDriver`/`resolveHeaders` (runtime) and types.
- Declares its typing via `declare module 'nexdk'` + `__apiUri: 'nest'`.

## Build/test
`pnpm --filter @pilota/driver-nest build` · `... test`. Tests mock `fetch`.
