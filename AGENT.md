# AGENT.md — @pilota/driver-supabase

## Role
Realtime driver over Supabase. `get`/`insert`/`update`/`remove` +
`subscribe` (`postgres_changes`, emits `data`/`connected`/`disconnected`).
Exposes `SupabaseDriver`.

## Dependency rule
- `nexdk`: **peerDependency** (+ devDependency `workspace:*`) — type-only usage.
- `@supabase/supabase-js`: real `dependency` (the client it wraps).
- Event type from `nexdk`, never beepr.

## Contract
Emit `'error'` then `throw` on failure; reactive `subscribe` returns an
unsubscribe function and emits `data`/`connected`/`disconnected`.

## Build/test
`pnpm --filter @pilota/driver-supabase build` · `... test`.
