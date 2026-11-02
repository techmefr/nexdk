---
title: '@nexdk/driver-firebase'
description: Firestore REST driver that converts typed values to plain records.
---

Driver for [Cloud Firestore](https://firebase.google.com/docs/firestore) through its REST API. Firestore stores typed values (`{ stringValue }`, `{ integerValue }`…). The driver encodes and decodes them, so your resources stay plain objects.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/drivers/firebase`).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk @nexdk/http @nexdk/driver-firebase
```

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
| `fetch` | `globalThis.fetch` | A `fetch` implementation used for every request, for example a mock. |

## Methods

The resource name is the collection name. Every returned record has its document id as `id`.

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET …/documents/{resource}` | `query` accepts `pageSize`, `pageToken`, `orderBy`. Returns `T[]`. |
| `find({ id }, onEvent?)` | `GET …/documents/{resource}/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/documents/{resource}` | Put `id` in the body to choose the document id. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/{id}` | Only the given fields change (`updateMask`). Set a field to `deleteField` (exported by the driver) to remove it; targeting a sub-field of a map is not supported, send the whole map. The document must exist. Needs at least one field. |
| `remove({ id }, onEvent?)` | `DELETE …/{id}` | Returns `{ success: boolean }`. |

## Pagination

`get` follows every `nextPageToken` and returns all the documents. If you set `pageSize` or `pageToken`, it makes one request and returns that page only; the array carries a non-enumerable `nextPageToken` property (`undefined` on the last page) to pass as the next `pageToken`.

## Values

| JavaScript | Firestore |
|------------|-----------|
| `string`, `boolean`, `null` | `stringValue`, `booleanValue`, `nullValue` |
| safe integer `number` | `integerValue` |
| other `number` (above 2^53, `NaN`, `Infinity`) | `doubleValue` |
| `bigint` | `integerValue` (`create` and `update` return it as a `bigint` when it is beyond the safe range; reads throw) |
| `Date` | `timestampValue` |
| array, object | `arrayValue`, `mapValue` |

`undefined` fields are skipped. Reading an `integerValue` outside the safe integer range throws, so no precision is lost silently. The document id always wins over a stored field named `id`.

Real-time listeners are not part of this driver.

## Errors

The collection name and the ids are URL-encoded. A failure emits `error` with `{ message, status, errors }`, then throws an `HttpError`. The `message` is the backend message when there is one and `errors` is normalized to `{ field: [message] }` when possible (see [`@nexdk/http`](/nexdk/packages/http/)); `data` keeps the raw body. The thrown error and the event carry the same `status` and `errors`. The `timeout` (milliseconds) and `signal` (`AbortSignal`) config options abort a request with a status 0 error; neither is set by default. A resource name that is empty, `.` or `..` is refused like an id.
