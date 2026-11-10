# AGENT.md — @nexdk/driver-strapi

## Role
Strapi v5 REST driver (`/api/{resource}`): `get`, `find`, `create`, `update` (PUT), `remove`. Unwraps the `{ data, meta }` envelope, sends `{ data }` on writes. Exposes `createStrapiDriver`, `strapiDriver`, `toStrapiQuery`. Built with `defineDriver`.

## Contract
- `get` follows every page (`meta.pagination.pageCount`) unless `pagination` sets `page`, `pageSize`, `start` or `limit`: then one request.
- `toStrapiQuery` builds bracket notation, skips `undefined` and `null`, throws beyond depth 16 and on circular references.
- Resource name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Dependency rule
`nexdk` and `@nexdk/http`: `peerDependencies` (`>=0.0.1 <1`) + devDependencies.

## Errors and options
- `message` is the backend message when identifiable and `errors` is normalized (see `@nexdk/http`); the thrown error and the `error` event carry the same `status` and `errors`. `config.timeout`, `config.signal` and `config.onResponse` go to `createRequest`; the per-call options (third argument) go through `withCallOptions`. A resource name that is empty, `.` or `..` throws `Invalid resource name`.

- An empty `$in` or `$notIn` list is encoded as `filters[f][$in]=`. Strapi silently caps `pagination.pageSize` and `limit` at 100 (`api.rest.maxLimit`), documented in the driver page. `toStrapiQuery` encodes a space as `%20` (aligned on `@nexdk/http` `toQuery`; Strapi `qs` reads both).

## Build/test
`pnpm --filter @nexdk/driver-strapi build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).

## Totals
`get` returns the data with a non-enumerable `pagination` property holding `meta.pagination` as sent (`page`, `pageSize`, `pageCount`, `start`, `limit`, `total`), from the first page when every page is followed; absent without `meta.pagination`. Typed as `StrapiCollection<T>`. `config.fetch` is a `FetchLike` (from `nexdk`), not `typeof fetch`.
