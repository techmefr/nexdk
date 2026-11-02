---
title: Introduction
description: Why nexdk exists and what problem it solves.
---

Most data-access layers are tied to a protocol (a REST client, a GraphQL client) or to a framework. `nexdk` separates two things:

- **the call grammar** (`resource.method`), the same for every backend;
- **the driver**, which translates that grammar to one protocol.

A multi-backend app (catalogue over GraphQL, orders over REST, presence in realtime) is written with one API. Resources are validated by any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType).

## Install

nexdk is not published to npm yet. Clone [the repository](https://github.com/techmefr/nexdk), then:

```bash
pnpm install
pnpm build
pnpm --filter "./packages/**" build
```

## A minimal example

```ts
import { createSdk, defineResource } from 'nexdk'
import { createNestDriver } from '@nexdk/driver-nest'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ id: z.number(), name: z.string() }),
})

export const sdk = createSdk({
  drivers: { nest: createNestDriver({ baseUrl: 'https://api.example.com' }) },
  resources: { nest: { products: product } },
})

const products = await sdk.nest.products.get({ page: 1 })
```

From here:

- [Anatomy of a call](/nexdk/guides/anatomy-of-a-call/): what `payload`, `onEvent` and `extra` do.
- [Packages](/nexdk/guides/packages/): what each package is for.
- [Writing a driver](/nexdk/guides/writing-a-driver/): the driver contract.
- [Ecosystem](/nexdk/guides/ecosystem/): beepr, shamock and dialectr.
