# AGENT.md — @nexdk/hooks (Vue)

## Role
Vue form helper: `useResourceForm(resource)` returns `values`, `errors`, `isDirty`, `handleSubmit`, `setServerErrors`, `fill`, `reset`. It is the only framework-coupled package.

## Dependency rule
- `nexdk`, `vue`, `zod` (3.24+ or 4): `peerDependencies` (+ devDependencies for build and test). Never `dependencies`.
- No dependency on `beepr` or `shamock`.
- `zod` is peer only, with no runtime import: defaults are read by duck typing (`_def.typeName === "ZodDefault"` for Zod 3, `_zod.def.type === "default"` for Zod 4, value or function default), never with `instanceof`, so a second copy of zod, or `zod/v4`, works.
- The resource schema must be a Zod object: `FormSchema` is structural (`StandardSchemaV1` plus `shape` and `safeParse`), and the value types come from the Standard Schema output. Valibot and ArkType are supported by the core only, not by this package.

## Behaviour notes
- `values` start at the Zod default, else `null`. `isDirty` compares against a baseline that `fill` and `reset` move.
- `setServerErrors` replaces `errors`. `handleSubmit` clears `errors`, validates with `safeParse`, then calls `onValid` with the parsed data.

## Note
Framework-specific by design. A React or Svelte equivalent belongs in its own package.

## Build/test
`pnpm --filter @nexdk/hooks build` · `... test`.
