---
title: '@nexdk/driver-supabase'
description: Realtime driver for Supabase (postgres_changes).
---

Driver over the Supabase client: table reads and writes, and `postgres_changes` realtime channels. Hand-written (it does not use `defineDriver`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/supabase`). It peer-depends on `nexdk` and `@supabase/supabase-js` (`^2.43.0`): install the client yourself, so you control its version.

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @supabase/supabase-js @nexdk/driver-supabase
```

## Config

```ts
import { createSdk } from 'nexdk'
import { SupabaseDriver } from '@nexdk/driver-supabase'

const sdk = createSdk({
  drivers: { supabase: new SupabaseDriver({ url: 'https://xyz.supabase.co', key: '…' }) },
})
```

`key` is the anon or the service key.

`fetch` is optional (type `FetchLike`, any function `(input, init?) => Promise<Response>`) and is forwarded to supabase-js as `global.fetch`, so every request of the client goes through it.

Each method takes per-call options `{ signal, timeout, headers }` as third argument: `signal` and `timeout` go to `abortSignal`, `headers` to the query. There is no `onResponse` option: supabase-js turns fetch failures into result objects. A query error carries `kind`: `timeout` or `abort` when the call signal aborted it, `network` for a status 0 answer, `http` for an error status. `subscribe` is a reactive method: an invalid `room_id` throws synchronously, even through `createSdk`.

## Methods

The resource name is the table name.

| Method | Notes |
|--------|-------|
| `get(payload?, onEvent?)` | `select *`. Every `payload` key becomes an equality filter. Returns `{ data: T[] }`. |
| `insert(payload?, onEvent?)` | Inserts the payload. Returns `{ data: T[] }`. |
| `update({ id, ...fields }, onEvent?)` | Updates the row with that `id`. Returns `{ data: T[] }`. |
| `remove({ id }, onEvent?)` | Deletes the row with that `id`. Returns `{ success: true }`: Postgrest answers no row by default (`return=minimal`). |
| `subscribe(payload?, onEvent?)` | Listens to `postgres_changes` on the table. Returns an unsubscribe function. |

`subscribe` accepts `{ room_id }` to filter on `room_id`. It must match `[\w-]+`, or the call throws. It emits `connected`, `disconnected` and `data`.

```ts
const unsubscribe = sdk.supabase.messages.subscribe({ room_id: 'general' }, (event, data) => {
  if (event === 'data') console.log(data)
})

unsubscribe()
```

## Errors

A Postgrest error emits `error` with `{ message, status, errors, code?, details?, hint? }`, then throws a `SupabaseQueryError`, an `SdkError` that exposes `status` (the HTTP status of the response), `errors` (`{ code, details, hint }`), `code`, `details` and `hint`. `details` and `hint` are `null` when Postgrest sends none. A `null` value in a `get` payload becomes an `is.null` filter, not `eq.null`. `update` and `remove` without a payload throw an `SdkError`.

```ts
import { SupabaseQueryError } from '@nexdk/driver-supabase'

const { error } = await sdk.supabase.messages.insert({ text: 'hi' })
if (error instanceof SupabaseQueryError) console.log(error.code, error.hint)
```
