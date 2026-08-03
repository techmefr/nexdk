---
title: '@nexdk/driver-nhost'
description: GraphQL + subscriptions driver for Hasura / Nhost.
---

GraphQL driver for a Hasura/Nhost backend, plus realtime subscriptions over `graphql-transport-ws`. Built with `defineDriver`.

## Install

```bash
pnpm add nexdk @nexdk/driver-nhost
```

## Config

```ts
import { NhostDriver } from '@nexdk/driver-nhost'

const nhost = new NhostDriver({
  endpoint: 'https://backend.nhost.run/v1/graphql',
  adminSecret: '…',       // optional
  headers: { Authorization: 'Bearer …' }, // or a resolver, re-evaluated on every request and WS (re)connect
})
```

## Methods

| Method | GraphQL operation | Notes |
|--------|--------------------|-------|
| `query<TData>(payload?, onEvent?, options?)` | query | `TData` defaults to the resource's record type, but GraphQL list operations usually return a keyed wrapper (`{ products: Product[] }`) — override it explicitly. |
| `mutation<TData>(payload?, onEvent?, options?)` | mutation | Returns `{ data: TData \| null }`. |
| `upsert({ data, conflictConstraint, updateColumns }, onEvent?, options?)` | mutation (upsert) | Hasura `on_conflict` shape. |
| `updateById({ id, data }, onEvent?, options?)` | mutation | |
| `updateWhere({ where, data }, onEvent?)` | mutation | Returns `{ affectedRows: number }`. |
| `deleteById({ id }, onEvent?)` | mutation | Returns `{ success: boolean }`. |
| `subscription(payload?, onEvent?, options?)` | subscription (WS) | Returns an unsubscribe function; emits `connected`/`disconnected`/`data`. |

`options?: { fragment?: string }` lets a call override the resource's default fragment.

## Errors

An **application-level GraphQL error** (an `errors` array in the response body, even alongside HTTP 200) is treated the same as a transport failure: `'error'` is emitted, then the call throws. This is the fix that closed the original silent-failure bug in this driver — a GraphQL error never resolves as if it had succeeded.
