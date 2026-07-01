# AGENT.md — nexdk (the SDK)

## Role
The core SDK. Exposes `createPilota`, `defineResource`, `defineDriver`,
`resolveHeaders`, and all the SDK types (`PilotaEvent`, `PilotaEventHandler`,
`PilotaDriver`, `Resource`/`AnyResource`, `TypedPilotaSDK`, the `ResourceApiKinds`
registry, `HeadersResolver`…). Runtime proxy: `sdk.[driver].[resource].[method]`.

## Hard rule — nexdk depends on NOTHING
- **No runtime `dependencies`.** Never import `beepr`, `chaff`, or any driver.
- The event contract (`PilotaEvent`, `PilotaEventHandler`) and `mergeEventHandlers`
  are **native here** (`src/types.ts`, `src/merge.ts`) — do not re-add a beepr import.
- `zod` is a `peerDependency` (used for the resource schema types), never a
  `dependency`.
- The event handler is structural (`(event, data) => void`): the SDK works with
  no `notify` and no `mock` — bringing `beepr`/`chaff` must stay optional.

## Layout
`create-pilota.ts` (proxy + resource binding) · `define-resource.ts` ·
`define-driver.ts` (the driver-authoring helper) · `typed-sdk.ts` (HKT registry
for end-to-end types) · `types.ts` · `merge.ts`.

## Build/test
`pnpm --filter nexdk build` · `pnpm --filter nexdk test` (must pass with beepr and
chaff absent).
