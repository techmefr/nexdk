---
title: nexdk API reference
description: Every runtime export of the nexdk core package.
---

```ts
import { ResponseValidationError, SdkError, createSdk, defineDriver, defineResource, resolveHeaders, toErrorPayload } from 'nexdk'
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
| `validateResponses?` | `boolean` | Off by default. Validates the answers of `get`, `find`, `create` and `update` against the resource schema. See [Validating responses](/nexdk/guides/standard-schema/#validating-responses-opt-in). |

The call proxy is described in [Anatomy of a call](/nexdk/guides/anatomy-of-a-call/).

## `defineResource(config)`

```ts
function defineResource<TSchema extends StandardSchemaV1>(
  config: ResourceConfig<TSchema>
): Resource<TSchema>
```

`config` is `{ name, schema, fragments?, relations?, validateResponses? }`. `validateResponses` overrides the SDK-wide setting for this resource. `schema` is any [Standard Schema](/nexdk/guides/standard-schema/) validator. `fragments` (`Record<string, string[]>`) and `relations` (`Record<string, () => AnyResource>`) default to `{}`. nhost reads `fragments` to choose the fields of a query.

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

## `SdkError`, `toErrorPayload(error)`

```ts
class SdkError extends Error {
  readonly status: number | undefined
  readonly errors: unknown
  readonly data: unknown
  constructor(message: string, init?: { status?: number; errors?: unknown; data?: unknown })
}

function toErrorPayload(error: unknown): { message: string; status?: number; errors?: unknown }
```

The typed error thrown by every driver. `toErrorPayload` builds the `error` event payload: `status` when the error has a numeric `status`, `errors` from `error.errors`, else `error.data` for an error with a status. See [Events](/nexdk/guides/events/#error-payload).

## Types

| Type | Role |
|------|------|
| `StandardSchemaV1` | The [Standard Schema](/nexdk/guides/standard-schema/) contract. |
| `SdkDriver` | `{ name, bindResource(name, resource) }`. |
| `SdkConfig` | The argument of `createSdk`. |
| `SdkEvent` | `'request' \| 'success' \| 'error' \| 'data' \| 'complete' \| 'connected' \| 'disconnected'`. |
| `SdkEventHandler` | `(event: SdkEvent, data?: unknown) => void`. |
| `Resource`, `AnyResource`, `ResourceConfig`, `ResourceMap` | The object returned by `defineResource`, and its config. |
| `InferSchema<TResource>` | The inferred record type of a resource. |
| `AsyncMethod`, `ReactiveMethod` | Signatures of a driver method. |
| `DriverDefinition`, `DriverMethod`, `DriverMethodContext`, `DefinedDriver` | Types behind `defineDriver`. |
| `HeadersResolver` | A record, or a function returning one. |
| `FetchLike` | `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`: the type of the `fetch` option of the REST drivers. Narrower than `typeof fetch`, so `mock.fetch` and the `fetch` of bun-types are accepted without a cast. |
| `ErrorEventPayload`, `SdkErrorInit` | The `error` event payload `{ message, status?, errors? }`, and the init of `SdkError`. |
| `ResourceApiKinds<T>` | The registry a driver augments to type its API. See [End-to-end typing](/nexdk/guides/writing-a-driver/#end-to-end-typing). |
| `ResourceApiFor`, `ResourceApiUri`, `TypedSdk`, `Sdk`, `ResourcesByDriver` | Types behind the typed SDK. |

## `ResponseValidationError`

```ts
class ResponseValidationError extends SdkError {
  constructor(resourceName: string, errors: Record<string, string[]>, data: unknown)
}
```

Thrown when `validateResponses` is on and an answer does not match the schema: `status` is 0, `errors` is keyed by dotted path (`1.name` for the second row, `data.0.name` inside a `data` envelope, `_` for the root), `data` is the raw answer. See [Validating responses](/nexdk/guides/standard-schema/#validating-responses-opt-in).
