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
