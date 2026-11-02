# AGENT.md — @nexdk/driver-lomkit

## Role
REST driver for Laravel + Lomkit REST API. `get` posts to `/{resource}/search`, `mutate` posts `{ mutate: [payload] }` to `/{resource}/mutate`, `delete` sends `DELETE /{resource}` with `{ resources: [...] }`. Exposes `LomkitDriver`. Hand-written, not built with `defineDriver`.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`), type-only usage.
- `@nexdk/http`: real `dependency` (`createRequest`, `resolveHeaders`; `HttpError` is thrown by `request`). Not `toQuery` or `splitId`.
- No dependency on `shamock` or `dialectr`: they are combined in application code (`toLomkit` output is the `get` payload).

## Contract
- Emit `error`, then rethrow the `HttpError` (an `SdkError`: `status`, `errors`, `data`). The event is `toErrorPayload(error)`: `{ message, status, errors }`. On a Laravel 422 `message` is the body message and `errors` the field map; without an `errors` key, `errors` is the raw body.
- `config.fetch` (optional) is passed to `createRequest` and replaces `globalThis.fetch`. The `request` and `httpRequest` names are private fields: a resource keyed like a driver member is refused by `createSdk`.
- `mutate` payload type is `LomkitMutatePayload<T>`: `attributes` is `Partial<T>` (schema output), `operation`, `key`, `relations` are typed, other keys stay free. Type tests live in `test/mutate-types.test-d.ts` (vitest typecheck).
- The resource name in the URL is `resource.name` (bound resource) else the call key, URL-encoded.
- `get` returns one page with `meta`. It never follows pages.
- `headers` is a record or a resolver, evaluated per request.

## Build/test
`pnpm --filter @nexdk/driver-lomkit build` · `... test` (runs the type tests too). Tests inject `fetch` through `config.fetch` or stub the global one.
