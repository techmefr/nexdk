# AGENT.md — @nexdk/driver-lomkit

## Role
REST driver for Laravel + Lomkit REST API. `get` posts to `/{resource}/search`, `mutate` posts `{ mutate: [payload] }` to `/{resource}/mutate`, `delete` sends `DELETE /{resource}` with `{ resources: [...] }`. Exposes `LomkitDriver`. Hand-written, not built with `defineDriver`.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`), type-only usage.
- `@nexdk/http`: `peerDependency` (`>=0.0.1 <1`) + devDependency (`createRequest`, `resolveHeaders`; `HttpError` is thrown by `request`). Not `toQuery` or `splitId`.
- No dependency on `shamock` or `dialectr`: they are combined in application code (`toLomkit` output is the `get` payload).

## Contract
- Emit `error`, then rethrow the `HttpError` (an `SdkError`: `status`, `errors`, `data`). The event is `toErrorPayload(error)`: `{ message, status, errors }`. On a Laravel 422 `message` is the body message and `errors` the field map; without an `errors` key, `errors` is the raw body.
- `config.fetch` (optional) is passed to `createRequest` and replaces `globalThis.fetch`. The `request` and `httpRequest` names are private fields: a resource keyed like a driver member is refused by `createSdk`.
- `mutate` payload type is `LomkitMutatePayload<T>`: `attributes` is `WriteInput<T>` (`Partial<T> & Record<string, unknown>`, from `nexdk`: schema fields typed, extra input fields such as a password accepted), `operation`, `key`, `relations` are typed, other keys stay free. Type tests live in `test/mutate-types.test-d.ts` (vitest typecheck).
- The resource name in the URL is `resource.name` (bound resource) else the call key, URL-encoded.
- `get` returns one page with `meta`. It never follows pages.
- `headers` is a record or a resolver, evaluated per request.

## Errors and options
- `message` is the backend message when identifiable and `errors` is normalized (see `@nexdk/http`); the thrown error and the `error` event carry the same `status` and `errors`. `config.timeout` and `config.signal` go to `createRequest`. A resource name that is empty, `.` or `..` throws `Invalid resource name`.

- Types follow the real responses: `get` returns the Laravel page (`data` plus root `current_page`, `last_page`, `per_page`, `total`, `from`, `to`, `meta`); `mutate` returns `{ created, updated }` and sends an array payload as the whole `mutate` list.

## Build/test
`pnpm --filter @nexdk/driver-lomkit build` · `... test` (runs the type tests too). Tests inject `fetch` through `config.fetch` or stub the global one.

## Lomkit protocol (source of truth: the PHP package `lomkit/laravel-rest-api` 2.23.2)
Everything specific to Lomkit lives here, never in the core. Verified against the real backend in `ecosystem-playground/real/lomkit`.
- Methods: `get` (`POST /search`), `mutate`, `delete` (`DELETE /`), `restore` (`POST /restore`), `forceDelete` (`DELETE /force`), `actions` (`POST /actions/<name>`, payload `{ name, search? | resources?, fields? }`, answer `{ data: { impacted } }`), `details` (`GET /`). `restore` and `forceDelete` only exist when the Laravel route has `withSoftDeletes()` (404 otherwise). `delete` keeps returning `{ success: true }`; `restore` and `forceDelete` return the body (`{ data, meta }`).
- Gates are requested in `search.gates` (names `viewAny|view|create|update|delete|restore|forceDelete`). Rows get `gates` (`authorized_to_*`), the `create` gate comes back in `meta.gates`. A gate is a boolean, or `{ allowed, message }` when `rest.gates.message.enabled`; `isGateAllowed` (`src/gates.ts`) reads both. An empty `meta` is `[]` on the wire.
- Types in `src/types.ts`: `LomkitSearch` (filters, sorts, selects, scopes, aggregates, includes, instructions, gates, text), `LomkitRelations` (discriminated per operation: attach and detach forbid `attributes`, detach forbids `pivot`, only sync has `without_detaching`), `LomkitGetResult<T, E>` (`E` types aggregate or include keys). Tests: `test/lomkit-types.test-d.ts`.
- 422 keys are converted in `src/errors.ts` (`withFieldNames`, used by `handleError` for the thrown error and the `error` event): `mutate.N.attributes.x` to `x`, `mutate.N.relations.rel.I.attributes.x` to `rel.I.x`, `search.x` to `x`, colliding names merged, others kept. The `HttpError` is the same object (its `errors` is replaced), `data` keeps the raw body. `@nexdk/repository` relies on it.
- Private member names (`resolveTarget`, `sendRequest`, `handleError`...) are refused as resource keys by `createSdk`: keep their number small.
