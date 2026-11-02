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

## Layout
`create-sdk.ts` (proxy, resource binding) · `errors.ts` (`SdkError`, `toErrorPayload`) · `define-resource.ts` · `define-driver.ts` · `typed-sdk.ts` (type registry) · `types.ts` · `merge.ts` · `standard-schema.ts`.

## Workspace
`packages/http` (REST toolkit), `packages/hooks` (Vue forms), `packages/drivers/*` (lomkit, nhost, supabase, nest, symfony, pocketbase, strapi, firebase), `docs/` (Starlight site).

## Docs rules
English, short, no comments in code blocks. Examples must run against the built packages. Nothing is published to npm: link to GitHub, never to npmjs.

## Build/test
`pnpm build` builds the core first, then every package in `packages/**` in dependency order (not `docs`). `pnpm typecheck` · `pnpm test` runs the core tests, then the tests of every package. `pnpm --filter docs build` builds the site. On a fresh clone: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test`.

Publishable packages declare `nexdk` (and `@nexdk/http` for REST drivers) as `peerDependencies` with the range `>=0.0.1 <1` (0.x aware), plus a `workspace:*` devDependency. `docs` is `private`.
