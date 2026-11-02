# AGENT.md — @nexdk/driver-nest (reference driver)

## Role
Conventional REST CRUD driver (common NestJS controller shape): `get`, `find`, `create`, `update`, `remove` map to GET, GET, POST, PATCH, DELETE on `/{resource}` and `/{resource}/{id}`. Exposes `createNestDriver(config)` and `nestDriver`.

It is the reference driver and the worked example of `docs/src/content/docs/guides/writing-a-driver.md`. Keep it exemplary.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`). Uses `defineDriver`.
- `@nexdk/http`: `peerDependency` (`>=0.0.1 <1`) + devDependency (`createRequest`, `toQuery`, `splitId`, `encodeId`, `resolveHeaders`). Do not hand-roll `fetch` here.
- Typing: `declare module 'nexdk'` + `__apiUri: 'nest'`.

## Contract
- The resource name and the id are URL-encoded (`encodeURIComponent`, `encodeId`).
- `get` is one request. No page following.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Build/test
`pnpm --filter @nexdk/driver-nest build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).
