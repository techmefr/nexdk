---
title: Introduction
description: Why nexdk exists and what problem it solves.
---

Most data-access abstractions are tied to a protocol (a REST client, a GraphQL client…) or to a framework. `nexdk` separates two things:

- **the call grammar** (`resource.method`), uniform across every backend;
- **the driver**, which knows how to translate that grammar to a concrete protocol.

The result: a multi-backend app (catalogue over GraphQL, transactions over REST, presence in real time) is written with a single API, validated by any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType…), on any frontend framework.

## Install

```bash
npm install nexdk
# plus the driver(s) you need, e.g. @nexdk/driver-lomkit
```

## A minimal example

```ts
import { createSdk, defineResource } from 'nexdk'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ id: z.number(), name: z.string(), price: z.number() }),
})

export const sdk = createSdk({
  drivers: { nhost, lomkit, supabase },
  resources: { nhost: { products: product } },
})
```

From here:

- [Anatomy of a call](/nexdk/guides/anatomy-of-a-call/) — what `payload` and `notify` do.
- [Packages](/nexdk/guides/packages/) — what each package in the workspace is for.
- [Writing a driver](/nexdk/guides/writing-a-driver/) — the contract a driver must follow.
