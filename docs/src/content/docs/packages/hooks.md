---
title: '@nexdk/hooks'
description: Vue composables for nexdk resources — forms with Zod validation.
---

Vue composables for `nexdk` resources. `useResourceForm` builds form state, dirty-tracking and server-error mapping straight from a resource's Zod schema — no separate form schema to maintain.

## Install

```bash
pnpm add nexdk @nexdk/hooks vue zod
```

## Usage

```ts
import { useResourceForm } from '@nexdk/hooks'

const { values, errors, isDirty, handleSubmit, setServerErrors, fill, reset } = useResourceForm(product)

const onSubmit = handleSubmit(async (data) => {
  await sdk.lomkit.products.mutate(data)
})
```

- **`values`** — a `Ref` of the form's current values, seeded from the schema's field defaults (`null` for fields with none).
- **`errors`** — a `Ref` of field → message[] validation errors, populated by `handleSubmit` on a failed `safeParse`.
- **`isDirty`** — a `ComputedRef<boolean>`, true when any field differs from its baseline (the initial values, or whatever `fill` last set).
- **`handleSubmit(onValid)`** — returns a submit handler: validates against the resource's schema, populates `errors` and returns early on failure, otherwise calls `onValid(data)` with the parsed, typed data.
- **`setServerErrors(serverErrors)`** — merge backend validation errors (e.g. a lomkit 422's `errors` map) into the same `errors` ref the form template already reads.
- **`fill(data)`** — patch `values` with partial data (e.g. loading an existing record to edit) and reset the dirty baseline to match.
- **`reset()`** — restore `values` to the schema's initial defaults and clear `errors`.

## The one Zod-specific package

`useResourceForm` reads `ZodObject`/`ZodDefault` internals directly to build initial values from the schema's own defaults, so `@nexdk/hooks` peer-depends on `zod` — see [Standard Schema § The one exception](/nexdk/guides/standard-schema/#the-one-exception). Every other `nexdk` package stays validator-agnostic.
