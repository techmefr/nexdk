# AGENT.md — @nexdk/driver-pocketbase

## Role
PocketBase records API driver (`/api/collections/{collection}/records`): `get`, `find`, `create`, `update`, `remove`. Exposes `createPocketbaseDriver` and `pocketbaseDriver`. Built with `defineDriver`.

## Contract
- `get` follows every page (`totalPages`) unless the caller sets `page` or `perPage`: then it makes one request.
- Collection name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` is thrown.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency). `@nexdk/http`: real `dependency`.

## Build/test
`pnpm --filter @nexdk/driver-pocketbase build` · `... test`. Tests mock `fetch`.
