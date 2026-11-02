---
title: React to statuses
description: Run one handler per HTTP status, for example to log out on a 401 or redirect on a 403.
---

`createSdk({ onStatus })` maps a status to a handler. It is the place for the reactions that belong to the whole application and not to one call: log out on a 401, redirect on a 403, report a 5xx.

```ts
import { createSdk } from 'nexdk'

const sdk = createSdk({
  drivers: { lomkit },
  onStatus: {
    401: async () => {
      await session.logout()
      await router.push('/login')
    },
    403: () => router.push('/forbidden'),
    '5xx': ({ error, resource }) => report(`${resource}: ${error.message}`),
  },
})
```

## Keys

- An exact status (`401`, `403`, `409`...).
- A family: `'4xx'` or `'5xx'`.

The exact status wins over the family: with `{ 403: a, '4xx': b }`, a 403 calls `a` and a 404 calls `b`. A status without a handler does nothing. A network failure (status 0) and an error without a numeric `status` never match.

## The handler

It receives one object:

| Field | Value |
|-------|-------|
| `error` | The thrown error (an `SdkError` with `status`, `errors` and `data`). |
| `driver` | The driver name, for example `lomkit`. |
| `resource` | The resource key of the call, for example `users`. |
| `method` | The driver method, for example `get`. |

## Rules

- It runs once per failed call, after `notify` and the per-call `onEvent` have received the `error` event.
- It may be asynchronous. The call waits for it before rejecting, so a logout is finished when your `catch` runs.
- It never hides the failure: the call still rejects with the original error.
- If it throws (or rejects), the exception is dropped. The notification and the original error are not affected.
- There is no retry and no token refresh. The handler observes the failure, it does not replay the call.

## In an OSDD app

Declare the handlers once, in the technical layer that builds the SDK, so functional layers only see the typed result or the thrown error.

```ts
import { createSdk } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'

export function createApiSdk(session: Session, router: Router) {
  return createSdk({
    drivers: { lomkit: new LomkitDriver({ baseUrl: '/api', headers: () => session.headers() }) },
    onStatus: {
      401: async () => {
        await session.logout()
        await router.push('/login')
      },
      403: () => router.push('/forbidden'),
    },
  })
}
```

Per-call messages stay with [events](/nexdk/guides/events/): `onStatus` is for application-wide reactions.
