# AGENT.md — @nexdk/driver-strapi

## Role
Strapi v5 REST driver (`/api/{resource}`): `get`, `find`, `create`, `update` (PUT), `remove`. Unwraps the `{ data, meta }` envelope, sends `{ data }` on writes. Exposes `createStrapiDriver`, `strapiDriver`, `toStrapiQuery`. Built with `defineDriver`.

## Contract
- `get` follows every page (`meta.pagination.pageCount`) unless `pagination` sets `page`, `pageSize`, `start` or `limit`: then one request.
- `toStrapiQuery` builds bracket notation, skips `undefined` and `null`, throws beyond depth 16 and on circular references.
- Resource name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency). `@nexdk/http`: real `dependency`.

## Build/test
`pnpm --filter @nexdk/driver-strapi build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).
