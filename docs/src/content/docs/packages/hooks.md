---
title: '@nexdk/hooks'
description: Vue composables for nexdk resources — forms with Zod validation.
---

`useResourceForm` builds form state, dirty tracking and server-error mapping from the Zod schema of a resource. There is no second form schema to maintain.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/hooks`). It peer-depends on `nexdk`, `vue` and `zod` (3 or 4).

Once published, install the package with everything it needs:

```bash
pnpm add nexdk vue zod @nexdk/hooks
```

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

The resource schema must be a Zod object schema (`z.object`): `useResourceForm` needs its `shape` and its `safeParse`.

- **`values`**: a `Ref` of the current values. Fields start at their Zod default, or `null`.
- **`errors`**: a `Ref` of field to messages, filled by `handleSubmit` when validation fails.
- **`isDirty`**: a `ComputedRef<boolean>`, true when a field differs from the baseline (the initial values, or what `fill` last set).
- **`handleSubmit(onValid)`**: returns a submit handler. It validates, sets `errors` and stops on failure, otherwise calls `onValid` with the parsed data.
- **`setServerErrors(serverErrors)`**: replaces `errors` with backend errors, for example the `errors` map of a lomkit 422.
- **`fill(data)`**: patches `values` and resets the dirty baseline.
- **`reset()`**: restores the initial values and clears `errors`.

## Supported schemas

`useResourceForm` is the one Zod-specific package. It supports Zod 3 (`^3.24`) and Zod 4 object schemas, and `nexdk` itself accepts any [Standard Schema](/nexdk/guides/standard-schema/#the-exceptions) validator.

- Initial values are read by duck typing, not with `instanceof`: a field with `_def.typeName === 'ZodDefault'` (Zod 3) or `_zod.def.type === 'default'` (Zod 4, including `zod/v4` in Zod 3.25) starts at its default, which can be a value or a function. Any other field starts at `null`.
- Because nothing is compared with `instanceof`, a schema built by another copy of `zod` (a duplicated install, a monorepo, `zod/v4`) behaves like any other.
- Validation calls `schema.safeParse`, and the types come from the Standard Schema output of the schema, so `values` and the data given to `onValid` are typed for both Zod versions.
- Defaults wrapped by another modifier (`.default(1).optional()`) are not unwrapped: the field starts at `null`.
- Valibot and ArkType schemas work with `nexdk`, the drivers and `defineResource`, but not with `useResourceForm`: they have no `shape` and no `safeParse`. Passing one throws a `ResourceFormSchemaError` when the form is created, and the types reject it.
