---
title: '@nexdk/driver-firebase'
description: Firestore REST driver that converts typed values to plain records.
---

Driver for [Cloud Firestore](https://firebase.google.com/docs/firestore) through its REST API. Firestore stores typed values (`{ stringValue }`, `{ integerValue }`…). The driver encodes and decodes them, so your resources stay plain objects.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/firebase`).

## Config

```ts
import { createSdk } from 'nexdk'
import { createFirebaseDriver } from '@nexdk/driver-firebase'

const sdk = createSdk({
  drivers: {
    firebase: createFirebaseDriver({
      projectId: 'my-project',
      headers: async () => ({ Authorization: 'Bearer …' }),
    }),
  },
})

const todos = await sdk.firebase.todos.get({ orderBy: 'title' })
```

| Option | Default | Notes |
|--------|---------|-------|
| `projectId` | required | Firebase project id. |
| `databaseId` | `(default)` | Named Firestore database. |
| `baseUrl` | `https://firestore.googleapis.com` | Point it at the emulator for local work. |
| `headers` | none | A record or a resolver, typically the user ID token. |

## Methods

The resource name is the collection name. Every returned record has its document id as `id`.

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET …/documents/{resource}` | `query` accepts `pageSize`, `pageToken`, `orderBy`. Returns `T[]`. |
| `find({ id }, onEvent?)` | `GET …/documents/{resource}/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/documents/{resource}` | Put `id` in the body to choose the document id. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/{id}` | Only the given fields change (`updateMask`). The document must exist. Needs at least one field. |
| `remove({ id }, onEvent?)` | `DELETE …/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every `nextPageToken` and returns all the documents. If you set `pageSize` or `pageToken`, it makes one request and returns that page only.

## Values

| JavaScript | Firestore |
|------------|-----------|
| `string`, `boolean`, `null` | `stringValue`, `booleanValue`, `nullValue` |
| integer `number`, `bigint` | `integerValue` |
| other `number` | `doubleValue` |
| `Date` | `timestampValue` |
| array, object | `arrayValue`, `mapValue` |

`undefined` fields are skipped. Reading an `integerValue` outside the safe integer range throws, so no precision is lost silently. The document id always wins over a stored field named `id`.

Real-time listeners are not part of this driver.

## Errors

The collection name and the ids are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`.
