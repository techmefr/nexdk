# AGENT.md — @nexdk/driver-firebase

## Role
Cloud Firestore REST driver: `get`, `find`, `create`, `update`, `remove`. Encodes and decodes Firestore typed values so resources stay plain objects. Exposes `createFirebaseDriver`, `firebaseDriver`, `encodeFields`, `decodeDocument`. Built with `defineDriver`.

## Contract
- `get` follows every `nextPageToken` unless the caller sets `pageSize` or `pageToken`: then one request.
- Values: `bigint` and integer numbers become `integerValue`, other numbers `doubleValue`, `Date` `timestampValue`, `undefined` fields are skipped.
- Decoding an `integerValue` outside the safe integer range throws.
- The document id (last segment of `name`) wins over a stored `id` field.
- `update` uses `updateMask` and `currentDocument.exists=true`, and needs at least one field.
- Collection name and ids are URL-encoded. Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Dependency rule
`nexdk` and `@nexdk/http`: `peerDependencies` (`>=0.0.1 <1`) + devDependencies.

## Errors and options
- `message` is the backend message when identifiable and `errors` is normalized (see `@nexdk/http`); the thrown error and the `error` event carry the same `status` and `errors`. `config.timeout` and `config.signal` go to `createRequest`. A resource name that is empty, `.` or `..` throws `Invalid resource name`.

- `get` with `pageSize` or `pageToken` returns one page with a non-enumerable `nextPageToken`. Numbers beyond the safe integer range, `NaN` and the infinities are `doubleValue`; `create` and `update` decode unsafe `integerValue` as `bigint`, reads still throw. The `deleteField` sentinel in `update` removes a field (mask only); sub-fields are not targetable.

## Build/test
`pnpm --filter @nexdk/driver-firebase build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).
