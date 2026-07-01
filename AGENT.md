# AGENT.md — @pilota/hooks (Vue)

## Role
Vue form helper: `useResourceForm(resource)` — form state, `isDirty`, `fill`,
`reset`, `handleSubmit`, server errors, Zod-default initialisation. This is the
**Vue-specific** package (the only framework-coupled one).

## Dependency rule
- `nexdk`, `vue`, `zod`: all **peerDependencies** (+ devDependencies for build/
  test). Never `dependencies`.
- Does NOT depend on `beepr` or `chaff` (they were dead deps — keep them out).
- Uses `zod` at runtime (`ZodDefault` check) and an `AnyResource` type from `nexdk`.

## Note
Framework-specific by design. A React/Svelte/Angular equivalent, if ever added,
belongs in its own package — do not widen this one.

## Build/test
`pnpm --filter @pilota/hooks build` · `... test`.
