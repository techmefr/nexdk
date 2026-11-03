---
title: Events
description: The unified event contract every driver follows.
---

Every call emits a subset of `request`, `success`, `error`, `data`, `complete`, `connected` and `disconnected`.

- Async methods emit `request`, then `success` or `error`.
- Reactive methods (subscriptions) return an unsubscribe function and emit `data`, `connected`, `disconnected` and, for a subscription ended by the server, `complete`.

The core emits `request`, `success` and `error`, once per call (`defineDriver`, or `traceCall` in a class driver). Drivers only do the transport and throw on failure; through `createSdk` the call then resolves `{ data: undefined, error }`, or rejects with `throw: true`. A failure is never swallowed.

```ts
sdk.lomkit.users.get({}, (event, data) => {
  if (event === 'error') console.error(data)
})
```

## Error payload

The `error` event carries `{ message, status?, errors? }`; the error itself is a typed `SdkError` (exported from `nexdk`) carrying `status`, `errors` and `data`.

- `status` is the HTTP status, set when the error has one (0 for a network failure).
- `errors` is the field-error map of the response body when it has an `errors` key (Laravel 422: `{ email: ['…'] }`), else the raw response body.
- `data` (on the error only) is the parsed response body.

`@nexdk/http` throws `HttpError`, a subclass of `SdkError`. lomkit, nest, symfony, pocketbase, strapi and firebase use it. nhost throws an `SdkError` (HTTP failures carry `status`, GraphQL errors carry `errors`). supabase throws `SupabaseQueryError`, an `SdkError` whose `errors` is `{ code, details, hint }`.

```ts
await sdk.lomkit.users.mutate({ operation: 'create', attributes: {} }, (event, data) => {
  if (event === 'error') {
    console.error(data.status, data.errors)
  }
})
```

supabase also keeps `code`, `details` and `hint` at the top level of the event, for compatibility.

## Global and per-call handlers

A global `notify` (given to `createSdk`) and the per-call `onEvent` both run, global first. Each handler is isolated: if one throws, the other still runs, and the first error is rethrown after both have run.

## Typing a handler

`SdkEvent` and `SdkEventHandler` are exported from `nexdk`. [beepr](/nexdk/guides/ecosystem/) builds a compatible handler with `createNotify`.
