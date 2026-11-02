---
title: nexdk API reference
description: Every runtime export of the nexdk core package.
---

```ts
import { createSdk, defineDriver, defineResource, resolveHeaders } from 'nexdk'
```

## `createSdk(config)`

```ts
function createSdk<TDrivers, TResources>(
  config: SdkConfig<TDrivers, TResources>
): TypedSdk<TDrivers, TResources>
```

Binds resources to drivers and returns the typed proxy.

| Field | Type | Notes |
|-------|------|-------|
| `drivers` | `Record<string, SdkDriver>` | Any object with `{ name, bindResource() }`. |
| `resources?` | `Record<driverKey, Record<resourceKey, AnyResource>>` | Bound with `driver.bindResource(resourceKey, resource)`. |
| `notify?` | `SdkEventHandler` | Runs on every call, together with the per-call `onEvent`. See [Events](/nexdk/guides/events/). |

The call proxy is described in [Anatomy of a call](/nexdk/guides/anatomy-of-a-call/).

## `defineResource(config)`

```ts
function defineResource<TSchema extends StandardSchemaV1>(
  config: ResourceConfig<TSchema>
): Resource<TSchema>
```

`config` is `{ name, schema, fragments?, relations? }`. `schema` is any [Standard Schema](/nexdk/guides/standard-schema/) validator. `fragments` (`Record<string, string[]>`) and `relations` (`Record<string, () => AnyResource>`) default to `{}`. nhost reads `fragments` to choose the fields of a query.

## `defineDriver(definition)`

```ts
function defineDriver<TConfig, TState, TMethods>(
  definition: DriverDefinition<TConfig, TState, TMethods>
): (config: TConfig) => DefinedDriver<TMethods>
```

`definition` is `{ name, setup: (config) => state, methods }`. See [Writing a driver](/nexdk/guides/writing-a-driver/).

## `resolveHeaders(headers)`

```ts
function resolveHeaders(
  headers: HeadersResolver | undefined
): Promise<Record<string, string>>
```

Resolves a record, or a function (sync or async) returning one. Also exported by [`@nexdk/http`](/nexdk/packages/http/).

## Types

| Type | Role |
|------|------|
| `StandardSchemaV1` | The [Standard Schema](/nexdk/guides/standard-schema/) contract. |
| `SdkDriver` | `{ name, bindResource(name, resource) }`. |
| `SdkConfig` | The argument of `createSdk`. |
| `SdkEvent` | `'request' \| 'success' \| 'error' \| 'data' \| 'connected' \| 'disconnected'`. |
| `SdkEventHandler` | `(event: SdkEvent, data?: unknown) => void`. |
| `Resource`, `AnyResource`, `ResourceConfig`, `ResourceMap` | The object returned by `defineResource`, and its config. |
| `InferSchema<TResource>` | The inferred record type of a resource. |
| `AsyncMethod`, `ReactiveMethod` | Signatures of a driver method. |
| `DriverDefinition`, `DriverMethod`, `DriverMethodContext`, `DefinedDriver` | Types behind `defineDriver`. |
| `HeadersResolver` | A record, or a function returning one. |
| `ResourceApiKinds<T>` | The registry a driver augments to type its API. See [End-to-end typing](/nexdk/guides/writing-a-driver/#end-to-end-typing). |
| `ResourceApiFor`, `ResourceApiUri`, `TypedSdk`, `Sdk`, `ResourcesByDriver` | Types behind the typed SDK. |
