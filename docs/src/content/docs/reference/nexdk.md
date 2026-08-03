---
title: nexdk API reference
description: Every runtime export of the nexdk core package.
---

## `createSdk(config)`

```ts
function createSdk<TDrivers, TResources>(
  config: SdkConfig<TDrivers, TResources>
): TypedSdk<TDrivers, TResources>
```

Binds `resources` to `drivers` and returns the typed SDK proxy. `config`:

| Field | Type | Notes |
|-------|------|-------|
| `drivers` | `Record<string, SdkDriver>` | Any object implementing `{ name, bindResource() }` — by hand or via `defineDriver`. |
| `resources?` | `Record<driverKey, Record<resourceKey, AnyResource>>` | Bound with `driver.bindResource(resourceName, resource)` before the driver is exposed. |
| `notify?` | `SdkEventHandler` | Fires on every call, merged with any per-call `onEvent` — see [Events](/nexdk/guides/events/). |

## `defineResource(config)`

```ts
function defineResource<TSchema extends StandardSchemaV1>(
  config: ResourceConfig<TSchema>
): Resource<TSchema>
```

Declares a resource once. `config`: `{ name: string, schema: TSchema, fragments?, relations? }` — `schema` is any [Standard Schema](/nexdk/guides/standard-schema/) validator; `fragments`/`relations` default to `{}` and are read by drivers that need them (e.g. GraphQL fragment selection).

## `defineDriver(definition)`

```ts
function defineDriver<TConfig, TState, TMethods>(
  definition: DriverDefinition<TConfig, TState, TMethods>
): (config: TConfig) => DefinedDriver<TMethods>
```

The recommended way to author a driver — see [Writing a driver](/nexdk/guides/writing-a-driver/) for the full guide. `definition`: `{ name: string, setup: (config) => state, methods: { ... } }`.

## `resolveHeaders(headers)`

```ts
function resolveHeaders(
  headers: HeadersResolver | undefined
): Promise<Record<string, string>>
```

Resolves a `HeadersResolver` (a static object, or a `() => Record | Promise<Record>` function re-evaluated before every request) to a plain record. Also re-exported from [`@nexdk/http`](/nexdk/packages/http/).

## Types

| Type | Role |
|------|------|
| `StandardSchemaV1` | The [Standard Schema](/nexdk/guides/standard-schema/) contract every `schema` must implement. |
| `SdkDriver` | `{ name: string, bindResource(name, resource): void }` — the minimum a driver must implement. |
| `SdkEvent` | `'request' \| 'success' \| 'error' \| 'data' \| 'connected' \| 'disconnected'`. |
| `SdkEventHandler` | `(event: SdkEvent, data?: unknown) => void`. |
| `Resource` / `AnyResource` | The object returned by `defineResource`. |
| `InferSchema<TResource>` | The inferred record type of a resource's schema. |
| `ResourceApiKinds<T>` | The higher-kinded-type registry a driver augments (via `declare module 'nexdk'`) to type its per-resource API — see [Writing a driver § End-to-end typing](/nexdk/guides/writing-a-driver/#end-to-end-typing). |
| `TypedSdk<TDrivers, TResources>` | The fully typed return type of `createSdk`. |
