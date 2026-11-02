# AGENT.md — @nexdk/driver-nest (reference driver)

## Role
Conventional REST CRUD driver (common NestJS controller shape): `get`, `find`, `create`, `update`, `remove` map to GET, GET, POST, PATCH, DELETE on `/{resource}` and `/{resource}/{id}`. Exposes `createNestDriver(config)` and `nestDriver`.

It is the reference driver and the worked example of `docs/src/content/docs/guides/writing-a-driver.md`. Keep it exemplary.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`). Uses `defineDriver`.
- `@nexdk/http`: real `dependency` (`request`, `toQuery`, `splitId`, `encodeId`, `resolveHeaders`). Do not hand-roll `fetch` here.
- Typing: `declare module 'nexdk'` + `__apiUri: 'nest'`.

## Contract
- The resource name and the id are URL-encoded (`encodeURIComponent`, `encodeId`).
- `get` is one request. No page following.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` is thrown.

## Build/test
`pnpm --filter @nexdk/driver-nest build` · `... test`. Tests mock `fetch`.
