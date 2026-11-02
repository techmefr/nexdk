---
title: '@nexdk/driver-nhost'
description: GraphQL + subscriptions driver for Hasura / Nhost.
---

GraphQL driver for a Hasura / Nhost backend, with subscriptions over `graphql-transport-ws`. Built with `defineDriver`.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/nhost`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/driver-nhost
```

## Config

```ts
import { createSdk, defineResource } from 'nexdk'
import { NhostDriver } from '@nexdk/driver-nhost'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ id: z.string(), name: z.string() }),
})

const sdk = createSdk({
  drivers: {
    nhost: new NhostDriver({
      endpoint: 'https://backend.nhost.run/v1/graphql',
      adminSecret: '…',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
  resources: { nhost: { products: product } },
})
```

`adminSecret` is optional. `headers` is a record or a resolver, evaluated on every request and on every WebSocket (re)connection.

`fetch` is optional: pass any function `(input, init?) => Promise<Response>` (the `FetchLike` type) and every HTTP query and mutation goes through it instead of `globalThis.fetch`. WebSocket subscriptions are not affected.

## Methods

| Method | GraphQL operation | Notes |
|--------|-------------------|-------|
| `query<TData>(payload?, onEvent?, options?)` | query | Returns `{ data, errors? }`. `data` is keyed by the resource name, so pass `TData` explicitly. |
| `mutation<TData>(payload?, onEvent?, options?)` | `insert_{resource}_one` | Returns `{ data }`. |
| `upsert({ data, conflictConstraint, updateColumns }, onEvent?, options?)` | insert with `on_conflict` | Returns `{ data }`. |
| `updateById({ id, data }, onEvent?, options?)` | `update_{resource}_by_pk` | Returns `{ data }`. |
| `updateWhere({ where, data }, onEvent?)` | `update_{resource}` | Returns `{ affectedRows }`. |
| `deleteById({ id }, onEvent?)` | `delete_{resource}_by_pk` | Returns `{ success: true }`. |
| `subscription(payload?, onEvent?, options?)` | subscription | Returns an unsubscribe function. Emits `connected`, `disconnected`, `data`, `complete` and `error`. |

```ts
const result = await sdk.nhost.products.query<{ products: { id: string; name: string }[] }>({
  where: { name: { _eq: 'A' } },
  limit: 5,
})
```

The payload keys of `query` and `subscription` become GraphQL arguments (`where`, `order_by`, `limit`, `offset`, `distinct_on`). Values always travel as GraphQL variables.

## Fields

The fields of a query come from the fragment named in `options` (`{ fragment: 'light' }`, default name `default`). Without that fragment, the keys of the schema shape (Zod objects) are used, else `id`. Fragments are declared on the resource:

```ts
const lightProduct = defineResource({
  name: 'products',
  schema: z.object({ id: z.string(), name: z.string() }),
  fragments: { light: ['id'] },
})
```

## Validation

Resource names, payload keys, `conflictConstraint` and `updateColumns` must match `[_A-Za-z][_0-9A-Za-z]*`, or the call throws before any request. Binding a resource with an invalid name throws too.

## Subscriptions

- Subscriptions share one WebSocket when an `adminSecret` is set and they use the same `headers` value (the same function or object, even across driver instances; without `headers`, the same driver instance). Without an `adminSecret`, each subscription gets its own connection, so credentials are never shared.
- `connected` is emitted when the connection is acknowledged (and again after a reconnection), `disconnected` when it drops or when the last subscription stops. A subscription that the server ends emits `complete`; a subscription that the server rejects emits `error` with `{ message, errors }` (the GraphQL errors).
- A close code between 4400 and 4499 (for example a rejected admin secret) emits `error` with `{ message, code, reason }` and does not reconnect.
- The connection reconnects with exponential backoff (500 ms up to 15 s) and subscribes again.
- A WebSocket to a plain `http` endpoint is refused unless the host is `localhost`, `127.0.0.1` or `[::1]`. Use `https`.

## Errors

A GraphQL `errors` array (even with HTTP 200) emits `error`, then throws an `SdkError` with the messages joined by `; ` and the GraphQL `errors` array in `errors`. A non-2xx response throws an `SdkError` with message `HTTP {status}`, `status`, the parsed body in `data` and its `errors` key, when it has one, in `errors`. The `error` event carries `{ message, status?, errors? }`.
