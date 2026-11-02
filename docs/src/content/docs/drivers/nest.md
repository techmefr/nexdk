---
title: '@nexdk/driver-nest'
description: Conventional REST CRUD driver for a common NestJS controller shape.
---

Conventional REST CRUD driver. **It is the reference driver**: the worked example of [Writing a driver](/nexdk/guides/writing-a-driver/), built with `defineDriver`.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/nest`).

## Config

```ts
import { createSdk } from 'nexdk'
import { createNestDriver } from '@nexdk/driver-nest'

const sdk = createSdk({
  drivers: {
    nest: createNestDriver({
      baseUrl: 'https://api.example.com',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
})

const users = await sdk.nest.users.get({ page: 1 })
```

`headers` is a record or a resolver, evaluated before every request.

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type, exported by `nexdk` and `@nexdk/http`) and every HTTP request goes through it instead of `globalThis.fetch`, for example `mock.fetch` from shamock or the `fetch` of bun-types, without a cast.

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET /{resource}` | `query` becomes the query string. Returns `T[]`. One request, no page following. |
| `find({ id }, onEvent?)` | `GET /{resource}/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST /{resource}` | Returns the created `T`. |
| `update({ id, ...fields }, onEvent?)` | `PATCH /{resource}/{id}` | Returns the updated `T`. |
| `remove({ id }, onEvent?)` | `DELETE /{resource}/{id}` | Returns `{ success: boolean }`. |

The resource name and the id are URL-encoded. An empty id, `.` and `..` are refused.

## Errors

A validation failure of a `ValidationPipe` (`{ statusCode, message: string[], error }`) is mapped to `errors` keyed by property, for example `{ email: ['email must be an email'] }` (the rule is in [`@nexdk/http`](/nexdk/packages/http/#nest-validation-messages)); messages that do not start with a property name go under `_`. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError` from [`@nexdk/http`](/nexdk/packages/http/), a typed `SdkError` with `status`, `errors` and `data`. The `message` is the backend message when there is one and `errors` is normalized to `{ field: [message] }` when possible (see [`@nexdk/http`](/nexdk/packages/http/)); `data` keeps the raw body. The thrown error and the event carry the same `status` and `errors`. The `timeout` (milliseconds) and `signal` (`AbortSignal`) config options abort a request with a status 0 error; neither is set by default. A resource name that is empty, `.` or `..` is refused like an id. See [Events](/nexdk/guides/events/#error-payload).
