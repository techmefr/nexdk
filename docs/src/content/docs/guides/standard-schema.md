---
title: Standard Schema (validators)
description: How nexdk stays agnostic to the validator you choose.
---

`nexdk` never hardcodes a validator. Instead it depends on [Standard Schema](https://standardschema.dev), a tiny interface that Zod 3.24+, Valibot and ArkType all implement — copied locally rather than added as a dependency, so `nexdk` keeps its zero-dependency core.

```ts
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': StandardSchemaV1.Props<Input, Output>
}
```

`defineResource({ name, schema })` accepts any object implementing this interface — so a resource declared with Zod, Valibot or ArkType works identically through `createSdk` and `defineDriver`. [`chaff`](https://www.npmjs.com/package/chaff), a separate standalone package, follows the same interface for schema-driven mock validation, if you want mocking alongside the SDK.

## The one exception

`@nexdk/hooks` is genuinely Zod-specific: its Vue form helper (`useResourceForm`) reads `ZodObject`/`ZodDefault` internals directly to build form defaults, so it peer-depends on `zod`. That is a deliberate, isolated exception — not a crack in the core's agnosticism.
