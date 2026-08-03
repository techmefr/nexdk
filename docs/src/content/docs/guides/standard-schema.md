---
title: Standard Schema (validators)
description: How nexdk stays agnostic to the validator you choose.
---

`nexdk` and `chaff` never hardcode a validator. Instead they depend on [Standard Schema](https://standardschema.dev), a tiny interface that Zod 3.24+, Valibot and ArkType all implement — copied locally in each package rather than added as a dependency, so `nexdk` keeps its zero-dependency core.

```ts
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': StandardSchemaV1.Props<Input, Output>
}
```

`defineResource({ name, schema })` accepts any object implementing this interface — so a resource declared with Zod, Valibot or ArkType works identically through `createSdk`, `defineDriver` and `chaff`'s mock validation.

## The one exception

`@nexdk/hooks` is genuinely Zod-specific: its Vue form helper (`useResourceForm`) reads `ZodObject`/`ZodDefault` internals directly to build form defaults, so it peer-depends on `zod`. That is a deliberate, isolated exception — not a crack in the core's agnosticism.
