---
title: Events
description: The unified event contract every driver follows.
---

Every call emits a subset of `request`, `success`, `error`, `data`, `connected` and `disconnected`.

- Async methods emit `request`, then `success` or `error`.
- Reactive methods (subscriptions) return an unsubscribe function and emit `data`, `connected` and `disconnected`.

The rule for drivers: **emit `error`, then throw.** A failure is never swallowed.

```ts
sdk.lomkit.users.get({}, (event, data) => {
  if (event === 'error') console.error(data)
})
```

## Error payload

Drivers built with `defineDriver` emit `error` with `{ message }`. When the failure is an `HttpError` from [`@nexdk/http`](/nexdk/packages/http/), the payload is `{ message, status, errors }`, where `errors` is the parsed response body.

```ts
await sdk.nest.users.find({ id: 9 }, (event, data) => {
  if (event === 'error') {
    console.error(data.status, data.errors)
  }
})
```

Hand-written drivers differ: lomkit emits `{ message, errors }` on a 422 and `{ message }` otherwise, and supabase emits the Postgrest error.

## Global and per-call handlers

A global `notify` (given to `createSdk`) and the per-call `onEvent` both run, global first. Each handler is isolated: if one throws, the other still runs, and the first error is rethrown after both have run.

## Typing a handler

`SdkEvent` and `SdkEventHandler` are exported from `nexdk`. [beepr](/nexdk/guides/ecosystem/) builds a compatible handler with `createNotify`.
