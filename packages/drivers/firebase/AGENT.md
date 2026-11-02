# AGENT.md — @nexdk/driver-firebase

## Role
Cloud Firestore REST driver: `get`, `find`, `create`, `update`, `remove`. Encodes and decodes Firestore typed values so resources stay plain objects. Exposes `createFirebaseDriver`, `firebaseDriver`, `encodeFields`, `decodeDocument`. Built with `defineDriver`.

## Contract
- `get` follows every `nextPageToken` unless the caller sets `pageSize` or `pageToken`: then one request.
- Values: `bigint` and integer numbers become `integerValue`, other numbers `doubleValue`, `Date` `timestampValue`, `undefined` fields are skipped.
- Decoding an `integerValue` outside the safe integer range throws.
- The document id (last segment of `name`) wins over a stored `id` field.
- `update` uses `updateMask` and `currentDocument.exists=true`, and needs at least one field.
- Collection name and ids are URL-encoded. Errors: `error` with `{ message, status, errors }`, then an `HttpError` is thrown.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency). `@nexdk/http`: real `dependency`.

## Build/test
`pnpm --filter @nexdk/driver-firebase build` · `... test`. Tests mock `fetch`.
