# AGENT.md — @nexdk/nuxt (Nuxt module)

## Role
Nuxt 4 module: reads one SDK config file, provides `$sdk` (one `createSdk` per Nuxt app, so per request in SSR) and auto-imports `useSdk()`.

## Dependency rule
- `@nuxt/kit`: `dependencies` (the only package of the repo with a runtime dependency, as every Nuxt module).
- `nexdk`, `nuxt`: `peerDependencies`. Drivers are the app's choice, never a dependency.

## How it works
- `src/module.ts`: option `sdk` (default `~/sdk.config`, config key `nexdk`) resolved with `resolvePath`. `addTemplate('nexdk/config.mjs')` re-exports its default export, `addTypeTemplate('types/nexdk.d.ts')` types `NuxtApp.$sdk` and `ComponentCustomProperties.$sdk` with `TypedSdk` from `typeof import(config).default` (a function export is unwrapped with `Awaited<ReturnType>`).
- `src/runtime/plugin.ts`: imports `#build/nexdk/config.mjs`, calls it with `nuxtApp` when it is a function, then `provide: { sdk: createSdk(config) }`.
- `src/runtime/use-sdk.ts`: `useNuxtApp().$sdk`.
- `types/`: ambient `#build/nexdk/config.mjs` and the `#app` augmentation for the package build only.
- Build: unbuild, `src/runtime` copied by mkdist to `dist/runtime`.

## Tests
- `test/module.test.ts`: `@nuxt/test-utils/e2e` on `test/fixture` (built module from `dist`): SSR HTML, then the page in chromium (`playwright-core`, browsers from `~/.cache/ms-playwright`) checks a client call.
- `test/types.test.ts`: `nuxi prepare` then `tsc --noEmit` on the fixture, with an `@ts-expect-error` on an unknown method.
- Build the package before testing.

## Build/test
`pnpm --filter @nexdk/nuxt build` · `... test`.
