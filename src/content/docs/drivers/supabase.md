---
title: '@nexdk/driver-supabase'
description: Realtime driver for Supabase (postgres_changes).
---

Realtime driver over Supabase's Postgrest + `postgres_changes` realtime channel. Hand-written (predates `defineDriver`).

## Install

```bash
pnpm add nexdk @nexdk/driver-supabase @supabase/supabase-js
```

## Config

```ts
import { SupabaseDriver } from '@nexdk/driver-supabase'

const supabase = new SupabaseDriver({
  url: 'https://xyz.supabase.co',
  key: '…', // anon or service key
})
```

## Methods

| Method | Notes |
|--------|-------|
| `get(payload?, onEvent?)` | Returns `{ data: T[] }`. |
| `insert(payload?, onEvent?)` | Returns `{ data: T[] }`. |
| `update(payload?, onEvent?)` | Returns `{ data: T[] }`. |
| `remove(payload?, onEvent?)` | Returns `{ success: boolean }`. |
| `subscribe(payload?, onEvent?)` | Subscribes to `postgres_changes` on the resource's table; returns an unsubscribe function. |

## Errors

Any Postgrest error emits `'error'` with the full detail (`{ message, code?, details?, hint? }`), then throws a `SupabaseQueryError` carrying `code`/`details`/`hint` as properties — so a caller can branch on `error.code` without re-parsing the message.

```ts
import { SupabaseQueryError } from '@nexdk/driver-supabase'

try {
  await sdk.supabase.messages.insert({ text: 'hi' })
} catch (err) {
  if (err instanceof SupabaseQueryError) console.log(err.code, err.hint)
}
```
