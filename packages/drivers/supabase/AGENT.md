# AGENT.md — @nexdk/driver-supabase

## Role
Driver over the Supabase client: `get`, `insert`, `update`, `remove`, plus `subscribe` (`postgres_changes`, emits `data`, `connected`, `disconnected`). Exposes `SupabaseDriver` and `SupabaseQueryError`. Hand-written, not built with `defineDriver`.

## Behaviour notes
- `get` turns each payload key into an `eq` filter. `update` and `remove` use `id`.
- `subscribe` accepts `{ room_id }`, which must match `[\w-]+`, else it throws.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`), type-only usage.
- `@supabase/supabase-js`: real `dependency`.

## Contract
Emit `error` with `{ message, code?, details?, hint? }`, then throw `SupabaseQueryError`. `subscribe` returns an unsubscribe function.

## Build/test
`pnpm --filter @nexdk/driver-supabase build` · `... test`.
