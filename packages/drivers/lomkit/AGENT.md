# AGENT.md — @nexdk/driver-lomkit

## Role
REST driver for Laravel + Lomkit REST API. `get` posts to `/{resource}/search`, `mutate` posts `{ mutate: [payload] }` to `/{resource}/mutate`, `delete` sends `DELETE /{resource}` with `{ resources: [...] }`. Exposes `LomkitDriver`. Hand-written, not built with `defineDriver`.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`), type-only usage.
- `@nexdk/http`: real `dependency` (`request`, `HttpError`, `resolveHeaders`). Not `toQuery` or `splitId`.
- No dependency on `shamock` or `dialectr`: they are combined in application code (`toLomkit` output is the `get` payload).

## Contract
- Emit `error`, then throw a plain `Error`. On a 422 the event is `{ message, errors }`, otherwise `{ message }` (no `status`).
- The resource name in the URL is `resource.name` (bound resource) else the call key, URL-encoded.
- `get` returns one page with `meta`. It never follows pages.
- `headers` is a record or a resolver, evaluated per request.

## Build/test
`pnpm --filter @nexdk/driver-lomkit build` · `... test`. Tests mock `fetch`.
