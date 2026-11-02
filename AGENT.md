# AGENT.md — nexdk (the SDK)

## Role
The core SDK. Exports `createSdk`, `defineResource`, `defineDriver`, `resolveHeaders`, `SdkError`, `toErrorPayload` and the types (`SdkEvent`, `SdkEventHandler`, `SdkDriver`, `Resource`, `AnyResource`, `TypedSdk`, `ResourceApiKinds`, `HeadersResolver`, `StandardSchemaV1`...). Runtime proxy: `sdk.[driver].[resource].[method](payload?, onEvent?, extra?)`.

## Hard rule: nexdk depends on NOTHING
- No runtime or peer `dependencies`. Never import `beepr`, `shamock`, `dialectr`, a driver or `zod`.
- The event contract (`src/types.ts`) and `mergeEventHandlers` (`src/merge.ts`) live here. Do not re-add a beepr import.
- `Resource` and `defineResource` are typed against `StandardSchemaV1` (`src/standard-schema.ts`), a local copy of the spec interface. Keep it identical to shamock's copy. Never add a validator as a dependency.
- The event handler is structural (`(event, data) => void`). The SDK works with no `notify`: beepr, shamock and dialectr stay optional and are combined in application code (see `docs/src/content/docs/guides/ecosystem.md`).

## Behaviour to keep
- `createSdk` proxy: an unknown method throws `Driver "x" has no method "y" for resource "z"`. Methods of `Object.prototype`, `name` and `bindResource` are never callable as resource methods. `createSdk` refuses, at binding time, a `resources` key that is already a member of the driver (`name`, `bindResource`, methods, fields), so a resource can never shadow driver internals.
- `mergeEventHandlers` runs global then local, isolates each handler (a throw does not skip the other) and rethrows the first error after both ran.
- `defineDriver` emits `request`, then `success` or `error`. `error` payload (`toErrorPayload`): `{ message, status?, errors? }`. `status` is set when the error has a numeric `status`; `errors` is `error.errors` when defined, else `error.data` for an error with a status. A method returning a function is reactive and returned as is.

## Status reactions
`createSdk({ onStatus: { 401: h, 403: h, '4xx': h, '5xx': h } })` runs one handler per failed call, in `src/on-status.ts`, wired in `src/create-sdk.ts`. The exact status wins over the family. The handler gets `{ error, driver, resource, method }` (`driver` is `driver.name`, `resource` the call key), runs after the driver emitted `error` (so after `notify` and the local `onEvent`), is awaited before the call rejects, and never replaces the original error: a throw or rejection of the handler is dropped. Errors without a numeric `status` and status 0 match nothing. No retry or refresh here. Keep it driver-agnostic: Lomkit or other protocol specifics never go in the core.

## Layout
`create-sdk.ts` (proxy, resource binding) · `on-status.ts` (status handlers) · `errors.ts` (`SdkError`, `toErrorPayload`) · `define-resource.ts` · `define-driver.ts` · `typed-sdk.ts` (type registry) · `types.ts` · `merge.ts` · `standard-schema.ts`.

## Workspace
`packages/http` (REST toolkit), `packages/hooks` (Vue forms), `packages/repository` (common repository interface), `packages/drivers/*` (lomkit, nhost, supabase, nest, symfony, pocketbase, strapi, firebase), `docs/` (Starlight site).

## Docs rules
English, short, no comments in code blocks. Examples must run against the built packages. Nothing is published to npm: link to GitHub, never to npmjs.

## Build/test
`pnpm build` builds the core first, then every package in `packages/**` in dependency order (not `docs`). `pnpm typecheck` · `pnpm test` runs the core tests, then the tests of every package. `pnpm --filter docs build` builds the site. On a fresh clone: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test`.

Publishable packages declare `nexdk` (and `@nexdk/http` for REST drivers) as `peerDependencies` with the range `>=0.0.1 <1` (0.x aware), plus a `workspace:*` devDependency. `docs` is `private`.

## Response validation (opt-in)
`createSdk({ validateResponses: true })` or `defineResource({ validateResponses })` (the resource wins) validates the answers of `get`, `find`, `create` and `update` against the resource schema with `schema['~standard'].validate`. Off by default: no behaviour change. `get` accepts an array or a `{ data: [...] }` envelope, the other methods a record; each row is validated, the validated output is returned (non-enumerable properties such as `pagination` are kept). A failure throws `ResponseValidationError` (an `SdkError`, status 0, `errors` keyed by dotted path with a row index, `_` for the root, raw answer in `data`) and emits `error`, after the driver emitted `success`. Code: `src/validate-response.ts`, wired in `src/create-sdk.ts`. Other methods (`remove`, `mutate`, nhost `query`...) are never validated.

## Types and packages
`WriteInput<T>` (`src/types.ts`) is the type of write bodies: `create` of nest, symfony, pocketbase, strapi, firebase, `attributes` of lomkit `mutate`, repository `create` and `update`. Do not narrow it back to `Partial<T>`: a write body carries input fields the schema does not return. Guarded by `packages/drivers/lomkit/test/mutate-types.test-d.ts`.

`FetchLike` is the type of every `fetch` option (see `@nexdk/http`). `packages/repository` (`@nexdk/repository`) is the common list/find/create/update/remove interface over the REST drivers; see its AGENT.md.
