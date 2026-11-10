# AGENT.md — @nexdk/nuxt (Nuxt module)

## Role
Nuxt 4 module (`meta.compatibility.nuxt >=4.0.0`): reads one SDK config file, provides `$sdk` (one `createSdk` per Nuxt app) and auto-imports `useSdk()` and `defineSdkConfig()` (from `nexdk`). Per-request isolation in SSR needs the function form of the config: a function export runs per Nuxt app, so drivers, `notify` and `onStatus` are per request; an object export is evaluated once per server process, its drivers and handlers are shared by every request and each app binds the resources to them again.

## Dependency rule
- `@nuxt/kit` (`^4.0.0`, the range of the `nuxt` peer): `dependencies` (the only package of the repo with a runtime dependency, as every Nuxt module).
- `nexdk`, `nuxt`: `peerDependencies`. Drivers are the app's choice, never a dependency.

## How it works
- `src/module.ts`: option `sdk` (default `~/sdk.config`, `app/sdk.config.ts` with the Nuxt 4 layout, config key `nexdk`) resolved with `findPath`; a missing file throws with the path and the `nexdk.sdk` option. `addTemplate('nexdk/config.mjs')` re-exports its default export, `addTypeTemplate('types/nexdk.d.ts')` types `NuxtApp.$sdk` and `ComponentCustomProperties.$sdk` with `TypedSdk` from `typeof import(config).default` (a function export is unwrapped with `Awaited<ReturnType>`, `resources?` and `throw?` are read optionally, `throw` is `true` only when literal).
- `src/runtime/plugin.ts`: imports `#build/nexdk/config.mjs`, calls it with `nuxtApp` when it is a function, then `provide: { sdk: createSdk(config) }`.
- `src/runtime/use-sdk.ts`: `useNuxtApp().$sdk`.
- `types/`: ambient `#build/nexdk/config.mjs` and the `#app` augmentation for the package build only.
- Build: unbuild, `src/runtime` copied by mkdist to `dist/runtime`.

## Tests
- `test/module.test.ts`: `@nuxt/test-utils/e2e` on `test/fixture` (function config, auto-imported `defineSdkConfig`, built module from `dist`): SSR HTML, then the page in chromium (`playwright-core`, browsers from `~/.cache/ms-playwright`) checks a client call.
- `test/object-form.test.ts`: `test/fixture-object` (object config, `throw: true`): the bare value is rendered and the config state is shared across requests.
- `test/types.test.ts`: `nuxi prepare` then `tsc --noEmit` on `fixture` (an `@ts-expect-error` asserts that a user name is a string), on `fixture-object` (an `@ts-expect-error` asserts that a `throw: true` call has no `error` key), and on `fixture-doc` with the config and usage examples copied from the README and the doc page (both must be identical); `fixture-missing` must fail with the missing-config message.
- Build the package before testing.

## Build/test
`pnpm --filter @nexdk/nuxt build` · `... test`.
