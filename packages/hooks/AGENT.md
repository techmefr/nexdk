# AGENT.md — @nexdk/hooks (Vue)

## Role
Vue form helper: `useResourceForm(resource)` returns `values`, `errors`, `isDirty`, `handleSubmit`, `setServerErrors`, `fill`, `reset`. It is the only framework-coupled package.

## Dependency rule
- `nexdk`, `vue`, `zod`: `peerDependencies` (+ devDependencies for build and test). Never `dependencies`.
- No dependency on `beepr` or `shamock`.
- `zod` is used at runtime (`ZodDefault`), and the resource schema must be a `ZodObject`.

## Behaviour notes
- `values` start at the Zod default, else `null`. `isDirty` compares against a baseline that `fill` and `reset` move.
- `setServerErrors` replaces `errors`. `handleSubmit` clears `errors`, validates with `safeParse`, then calls `onValid` with the parsed data.

## Note
Framework-specific by design. A React or Svelte equivalent belongs in its own package.

## Build/test
`pnpm --filter @nexdk/hooks build` · `... test`.
