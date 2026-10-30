---
title: '@nexdk/driver-firebase'
description: Firestore REST driver that converts typed values to plain records.
---

Driver for [Cloud Firestore](https://firebase.google.com/docs/firestore) through its REST API. Firestore stores typed values (`{ stringValue }`, `{ integerValue }`…): the driver encodes and decodes them so your resources stay plain objects. Each returned record carries its document id as `id`.

## Install

```bash
pnpm add nexdk @nexdk/driver-firebase
```

## Config

```ts
import { createFirebaseDriver } from '@nexdk/driver-firebase'

const firebase = createFirebaseDriver({
  projectId: 'my-project',
  headers: async () => ({ Authorization: `Bearer ${await getIdToken()}` }),
})
```

| Option | Default | Notes |
|--------|---------|-------|
| `projectId` | required | Firebase project id. |
| `databaseId` | `(default)` | Named Firestore database. |
| `baseUrl` | `https://firestore.googleapis.com` | Point it at the emulator for local work. |
| `headers` | none | Static headers or a resolver, typically the user's ID token. |

## Methods

| Method | Maps to | Notes |
|--------|---------|-------|
| `get(query?, onEvent?)` | `GET …/documents/{resource}` | `query` accepts `pageSize`, `pageToken`, `orderBy`. Returns `T[]`. |
| `find({ id }, onEvent?)` | `GET …/documents/{resource}/{id}` | Returns `T`. |
| `create(body, onEvent?)` | `POST …/documents/{resource}` | Pass `id` in the body to choose the document id. |
| `update({ id, ...fields }, onEvent?)` | `PATCH …/{id}?updateMask…` | Only the given fields change. |
| `remove({ id }, onEvent?)` | `DELETE …/{id}` | Returns `{ success: boolean }`. |

Integers are sent as `integerValue`, other numbers as `doubleValue`, `Date` as `timestampValue`. Real-time listeners are not part of this driver yet.
