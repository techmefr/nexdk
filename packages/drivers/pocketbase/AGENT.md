# AGENT.md — @nexdk/driver-pocketbase

## Role
PocketBase records API driver (`/api/collections/{collection}/records`): `get`, `find`, `create`, `update`, `remove`. Exposes `createPocketbaseDriver` and `pocketbaseDriver`. Built with `defineDriver`.

## Contract
- `get` follows every page (`totalPages`) unless the caller sets `page` or `perPage`: then it makes one request.
- Collection name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency). `@nexdk/http`: real `dependency`.

## Build/test
`pnpm --filter @nexdk/driver-pocketbase build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).
