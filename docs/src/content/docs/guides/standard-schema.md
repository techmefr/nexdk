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

- `@nexdk/hooks` is Zod-specific (Zod 3 and Zod 4): `useResourceForm` reads `shape` and the default of each field by duck typing (`_def.typeName` or `_zod.def.type`) and validates with `safeParse`. See [`@nexdk/hooks`](/nexdk/packages/hooks/#supported-schemas).
- `@nexdk/driver-nhost` reads `schema.shape` (a Zod object shape) to list the fields of a query when the resource has no fragment. Without a shape it selects `id`.

## Validating responses (opt-in)

By default the schema is a type source: it types every driver call and nothing is checked at runtime. A response that does not match the schema is returned as is.

Set `validateResponses` to check the answers of `get`, `find`, `create` and `update` with the validator's `~standard.validate`:

```ts
const sdk = createSdk({
  drivers: { pocketbase: createPocketbaseDriver({ baseUrl }) },
  resources: { pocketbase: { posts } },
  validateResponses: true,
})

const other = defineResource({ name: 'tags', schema: tagSchema, validateResponses: false })
```

The resource setting wins over the SDK one. Each row is validated: `get` accepts an array or a `{ data: [...] }` envelope (Lomkit), the other methods a record. `remove`, `mutate` (Lomkit) and the nhost methods are not validated. The value returned is the validator output, so a transforming schema (`z.coerce.number()`) changes what you get; non-enumerable properties such as `pagination` are kept.

A mismatch gives `error`: a `ResponseValidationError`, an `SdkError` with `status` 0, `errors` as `{ '1.name': ['Required'] }` (dotted path, row index first, `_` for the root) and the raw answer in `data`. The `error` event is emitted instead of `success`.

What it brings: a backend that drifts from the schema fails at the call site, with the field named, instead of later in the UI. What it costs: the validator runs on every row of every answer, so a list of 100 rows is 100 validations; the validator is bundled anyway when you use its types (12 to 25 kB gzip with zod, valibot is smaller); and a schema stricter than the backend turns a harmless extra or missing field into a failed call. It checks the shape of the answer, not that the data is right. Use it in development, in tests, or for a backend you do not control; leave it off where the cost matters and the backend is yours.
