# AGENT.md — @nexdk/driver-strapi

## Role
Strapi v5 REST driver (`/api/{resource}`): `get`, `find`, `create`, `update` (PUT), `remove`. Unwraps the `{ data, meta }` envelope, sends `{ data }` on writes. Exposes `createStrapiDriver`, `strapiDriver`, `toStrapiQuery`. Built with `defineDriver`.

## Contract
- `get` follows every page (`meta.pagination.pageCount`) unless `pagination` sets `page`, `pageSize`, `start` or `limit`: then one request.
- `toStrapiQuery` builds bracket notation, skips `undefined` and `null`, throws beyond depth 16 and on circular references.
- Resource name and ids are URL-encoded.
- Errors: `error` with `{ message, status, errors }`, then an `HttpError` is thrown.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency). `@nexdk/http`: real `dependency`.

## Build/test
`pnpm --filter @nexdk/driver-strapi build` · `... test`. Tests mock `fetch`.
