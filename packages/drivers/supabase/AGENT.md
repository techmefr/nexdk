# AGENT.md — @nexdk/driver-supabase

## Role
Driver over the Supabase client: `get`, `insert`, `update`, `remove`, plus `subscribe` (`postgres_changes`, emits `data`, `connected`, `disconnected`). Exposes `SupabaseDriver` and `SupabaseQueryError`. Hand-written, not built with `defineDriver`.

## Behaviour notes
- `get` turns each payload key into an `eq` filter. `update` and `remove` use `id`.
- `subscribe` accepts `{ room_id }`, which must match `[\w-]+`, else it throws.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`), type-only usage.
- `@supabase/supabase-js`: `peerDependency` (`^2.43.0`) + devDependency, like every external library of a driver. Never `dependencies`.

## Contract
Emit `error` with `{ message, status, errors, code?, details?, hint? }` (`toErrorPayload` merged over the Postgrest error), then throw `SupabaseQueryError`, an `SdkError` (`status` from the supabase-js response, `errors` = `{ code, details, hint }`). `config.fetch` (optional) is passed to `createClient` as `global.fetch`. `subscribe` returns an unsubscribe function.

- A `null` payload value is an `is.null` filter. `update` and `remove` without a payload throw an `SdkError`. `details` and `hint` can be `null`.

## Build/test
`pnpm --filter @nexdk/driver-supabase build` · `... test`.

## Call options and events
- Methods pass their name to `traceCall`. The per-call options go through `applyCallOptions` (`src/call-options.ts`): `callSignal` (signal and timeout combined) to `abortSignal`, `headers` to `setHeader`; nothing is called without options. The error kind comes from the same signal (`failureKind`), else `network` for status 0 and `http` for an error status. `reactiveMethods = ['subscribe']`.
- No `onResponse`: supabase-js turns fetch errors into result objects, so a hook exception could not stay the error of the call.
- `remove` keeps `{ success: true }`: Postgrest answers no row with the default `return=minimal`.
