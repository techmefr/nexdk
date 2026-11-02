---
title: '@nexdk/driver-lomkit'
description: REST driver for Laravel + Lomkit REST API.
---

REST driver for a Laravel backend using the [Lomkit](https://github.com/lomkit/laravel-rest-api) search, mutate and delete conventions. Hand-written (it does not use `defineDriver`).

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/lomkit`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http @nexdk/driver-lomkit
```

## Config

```ts
import { createSdk, defineResource } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { z } from 'zod'

const user = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const sdk = createSdk({
  drivers: {
    lomkit: new LomkitDriver({
      baseUrl: 'https://api.example.com',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
  resources: { lomkit: { users: user } },
})
```

`headers` is a record or a resolver, evaluated before every request.

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type, exported by `nexdk` and `@nexdk/http`) and every HTTP request goes through it instead of `globalThis.fetch`, for example `mock.fetch` from shamock or the `fetch` of bun-types, without a cast.

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(payload?, onEvent?)` | `POST /{resource}/search` | The payload is the body. Returns the Laravel page: `{ data: T[], current_page, last_page, per_page, total, from, to, meta }`. |
| `mutate(payload?, onEvent?)` | `POST /{resource}/mutate` | Sends `{ mutate: [payload] }`, or `{ mutate: payload }` when `payload` is an array. Returns `{ created: key[], updated: key[] }`. `payload` is a `LomkitMutatePayload<T>`: `attributes` is typed `WriteInput<T>`: the schema fields are optional and typed, other keys are accepted. |
| `delete({ resources }, onEvent?)` | `DELETE /{resource}` | Sends `{ resources: [...] }`. Returns `{ success: true }`. |

The URL uses the `name` of the bound resource, URL-encoded, or the call key when no resource is bound.

`LomkitMutatePayload<T>` is `{ operation?, key?, attributes?: WriteInput<T>, relations?, ...other keys }`, with `WriteInput<T> = Partial<T> & Record<string, unknown>`. A schema field with the wrong type is a type error, while a field the resource does not return (a `password` sent on creation) is accepted. Reads keep the exact `T`.

`get` returns one page; the pagination fields (`current_page`, `last_page`, `per_page`, `total`) are at the root of the result. It does not follow pages: set `search.page` and `search.limit` yourself.

```ts
const { data, total } = await sdk.lomkit.users.get({
  search: { filters: [{ field: 'name', operator: 'like', value: 'A%' }], limit: 20, page: 1 },
})
```

[dialectr](/nexdk/guides/ecosystem/#dialectr) can build this payload with `toLomkit`.

## Errors

A failure emits `error`, then throws the `HttpError` from [`@nexdk/http`](/nexdk/packages/http/), a typed `SdkError` with `status`, `errors` and `data`.

- On a 422, the message is the Laravel `message`, `errors` is the field map (`{ email: ['…'] }`) and `data` is the full body.
- The `error` event carries `{ message, status, errors }`. When the body has no `errors` key, `errors` is the raw response body.
- A network failure has `status` 0.

```ts
import { SdkError } from 'nexdk'

try {
  await sdk.lomkit.users.mutate({ operation: 'create', attributes: { email: '' } })
} catch (error) {
  if (error instanceof SdkError && error.status === 422) console.log(error.errors)
}
```

```ts
await sdk.lomkit.users.mutate({ operation: 'create', attributes: {} }, (event, data) => {
  if (event === 'error') console.error(data)
})
```

The thrown error only has the message. Read field errors from the event.
