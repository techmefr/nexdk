---
title: '@nexdk/hooks'
description: Vue composables for nexdk resources — forms with Zod validation.
---

`useResourceForm` builds form state, dirty tracking and server-error mapping from the Zod schema of a resource. There is no second form schema to maintain.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/hooks`). It peer-depends on `nexdk`, `vue` and `zod`.

## Usage

```ts
import { defineResource } from 'nexdk'
import { useResourceForm } from '@nexdk/hooks'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ name: z.string().min(1), price: z.number().default(0) }),
})

const { values, errors, isDirty, handleSubmit, setServerErrors, fill, reset } = useResourceForm(product)

const onSubmit = handleSubmit(async (data) => {
  await sdk.lomkit.products.mutate({ operation: 'create', attributes: data })
})
```

The resource schema must be a `z.object`.

- **`values`**: a `Ref` of the current values. Fields start at their Zod default, or `null`.
- **`errors`**: a `Ref` of field to messages, filled by `handleSubmit` when validation fails.
- **`isDirty`**: a `ComputedRef<boolean>`, true when a field differs from the baseline (the initial values, or what `fill` last set).
- **`handleSubmit(onValid)`**: returns a submit handler. It validates, sets `errors` and stops on failure, otherwise calls `onValid` with the parsed data.
- **`setServerErrors(serverErrors)`**: replaces `errors` with backend errors, for example the `errors` map of a lomkit 422.
- **`fill(data)`**: patches `values` and resets the dirty baseline.
- **`reset()`**: restores the initial values and clears `errors`.

## The one Zod-specific package

`useResourceForm` reads `ZodObject` and `ZodDefault` internals to build the initial values, so `@nexdk/hooks` peer-depends on `zod`. See [Standard Schema](/nexdk/guides/standard-schema/#the-exceptions).
