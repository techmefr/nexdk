# AGENT.md — @nexdk/repository

## Role
The common `Repository<T, Id, Params>` interface (`list`, `find`, `create`, `update`, `remove`) over the nexdk REST driver APIs, with `Page<T>` = `{ items, total, page, perPage }`. Adapters: `lomkitRepository`, `pocketbaseRepository`, `strapiRepository`, `nestRepository`, `symfonyRepository`. Each takes the resource API (`sdk.driver.resource`).

## Dependency rule
- No runtime `dependencies`. `nexdk` is a `peerDependency` (`>=0.0.1 <1`) and the only runtime import (`SdkError`).
- Drivers (`@nexdk/driver-*`) are optional `peerDependencies` (`peerDependenciesMeta.optional`), imported as types only. Never import dialectr, shamock, zod or a validator in `src/`.
- `@nexdk/http` and the drivers are `workspace:*` devDependencies for the tests.

## Behaviour to keep
- `total` is the backend number (Lomkit root `total`, PocketBase `pagination.totalItems`, Strapi `pagination.total`, Symfony `pagination.totalItems`) when it is a non-negative integer, else `null`. Nest is always `null`. No second request to count.
- `items` is a plain copy of the driver array (the non-enumerable `pagination` is dropped). `page` and `perPage` always come from the arguments, never from `params`.
- `paging` throws `RangeError` for a page or size that is not a positive integer. Defaults: page 1, `DEFAULT_PER_PAGE` 20.
- Errors are the nexdk `SdkError` untouched, except `notFound()` (status 404, Lomkit `find` on an empty search). The Lomkit field names (`mutate.N.attributes.` stripped from `errors` keys) come from `@nexdk/driver-lomkit` itself, the adapter does nothing. No repository-specific error class.
- `update` sends `{ ...patch, id }`: the id argument wins over an `id` in the patch.
- Lomkit `create` and `update` are two requests (mutate, then a search by `key`, default `id`).
- Not covered, documented as such: supabase (no range or count), firebase (token pages), nhost (GraphQL).

## Tests
`test/conformance.ts` is the shared suite (`defineConformance(target)`): run for each adapter in `test/conformance.test.ts` over a fake `fetch` per backend (`test/support/fakes.ts`, in-memory `Store`). Adapter specifics (params, paging functions, totals, Lomkit unprefix) are in `test/adapters.test.ts`; types in `test/types.test-d.ts`. A third party extends it by adding a `defineConformance` target against a real backend; never weaken a case to make an adapter pass.

## Build/test
`pnpm --filter @nexdk/repository build` · `... test`.
