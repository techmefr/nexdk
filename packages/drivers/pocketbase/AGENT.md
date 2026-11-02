# AGENT.md — @nexdk/driver-pocketbase

## Role
PocketBase records API driver (`/api/collections/{collection}/records`): `get`, `find`, `create`, `update`, `remove`. Exposes `createPocketbaseDriver` and `pocketbaseDriver`. Built with `defineDriver`.

## Contract
- `get` follows every page unless the caller sets `page` or `perPage`: then it makes one request (a lone `page` is one page of the server default, 30). With `totalPages` -1 (`skipTotal`) it keeps asking for the next page while the previous one was full (`perPage` of the response), and stops on a short or empty page.
- A 400 without field errors (unknown filter, sort or field, malformed filter) throws an `HttpError` whose message is `PocketBase rejected the request: <server message>`; nothing else is added. Validation errors keep their message and expose `errors` as `{ field: [message] }`.
- Collection name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Dependency rule
`nexdk` and `@nexdk/http`: `peerDependencies` (`>=0.0.1 <1`) + devDependencies.

## Build/test
`pnpm --filter @nexdk/driver-pocketbase build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).

## Totals
`get` returns the items with a non-enumerable `pagination` property `{ page, perPage, totalItems, totalPages }` (from the first page when every page is followed; a negative value from `skipTotal` becomes `undefined`), same pattern as symfony and firebase. Typed as `PocketbaseCollection<T>`. `config.fetch` is a `FetchLike` (from `nexdk`), not `typeof fetch`.
