---
title: Standard Schema (validators)
description: How nexdk stays agnostic to the validator you choose.
---

`nexdk` never hardcodes a validator. It depends on [Standard Schema](https://standardschema.dev), a small interface that Zod 3.24+, Valibot and ArkType implement. The interface is copied into the package, so the core keeps zero dependencies.

```ts
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>
}
```

`defineResource({ name, schema })` accepts any object implementing it. The inferred type of a resource is `InferSchema<typeof resource>`, and it types every driver call.

[shamock](https://github.com/techmefr/shamock) follows the same interface to validate mock data. See [Ecosystem](/nexdk/guides/ecosystem/).

## The exceptions

- `@nexdk/hooks` is Zod-specific: `useResourceForm` reads `ZodObject` and `ZodDefault` internals to build form defaults.
- `@nexdk/driver-nhost` reads `schema.shape` (a Zod object shape) to list the fields of a query when the resource has no fragment. Without a shape it selects `id`.
