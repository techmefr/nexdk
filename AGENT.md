# AGENT.md — nexdk (the SDK)

## Role
The core SDK. Exposes `createSdk`, `defineResource`, `defineDriver`,
`resolveHeaders`, and all the SDK types (`SdkEvent`, `SdkEventHandler`,
`SdkDriver`, `Resource`/`AnyResource`, `TypedSdk`, the `ResourceApiKinds`
registry, `HeadersResolver`…). Runtime proxy: `sdk.[driver].[resource].[method]`.

## Hard rule — nexdk depends on NOTHING
- **No runtime or peer `dependencies` at all.** Never import `beepr`, `shamock`,
  any driver, or `zod`.
- The event contract (`SdkEvent`, `SdkEventHandler`) and `mergeEventHandlers`
  are **native here** (`src/types.ts`, `src/merge.ts`) — do not re-add a beepr import.
- `Resource`/`defineResource` are typed against `StandardSchemaV1`
  (`src/standard-schema.ts`), a tiny interface copied locally per the spec's own
  guidance — never add `zod` (or any validator) as a dependency to type them.
  Any validator that implements Standard Schema (Zod 3.24+, Valibot, ArkType…)
  works with `defineResource` as-is.
- The event handler is structural (`(event, data) => void`): the SDK works with
  no `notify` and no `mock` — bringing `beepr`/`shamock` must stay optional.

## Layout
`create-sdk.ts` (proxy + resource binding) · `define-resource.ts` ·
`define-driver.ts` (the driver-authoring helper) · `typed-sdk.ts` (HKT registry
for end-to-end types) · `types.ts` · `merge.ts` · `standard-schema.ts` (local
Standard Schema contract — keep it byte-identical to shamock's copy).

## Build/test
`pnpm --filter nexdk build` · `pnpm --filter nexdk test` (must pass with beepr and
shamock absent).
