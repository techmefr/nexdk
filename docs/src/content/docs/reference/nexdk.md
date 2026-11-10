---
title: nexdk API reference
description: Every runtime export of the nexdk core package.
---

```ts
import { ResponseValidationError, SdkError, createSdk, defineDriver, defineResource, resolveHeaders, toErrorPayload, traceCall } from 'nexdk'
```

## `createSdk(config)`

```ts
function createSdk<TDrivers, TResources, TThrow extends boolean = false>(
  config: SdkConfig<TDrivers, TResources> & { throw?: TThrow }
): TypedSdk<TDrivers, TResources, TThrow>
```

Binds resources to drivers and returns the typed proxy. An async call resolves `SdkResult<T>`: `{ data, error: undefined }` or `{ data: undefined, error }`, after `notify` and `onStatus` ran.

| Field | Type | Notes |
|-------|------|-------|
| `drivers` | `Record<string, SdkDriver>` | Any object with `{ name, bindResource() }`. |
| `resources?` | `Record<driverKey, Record<resourceKey, AnyResource>>` | Bound with `driver.bindResource(resourceKey, resource)`. |
| `notify?` | `SdkEventHandler` | Runs on every call, together with the per-call `onEvent`. See [Events](/nexdk/guides/events/). |
| `onStatus?` | `{ [status: number]: handler, '4xx'?: handler, '5xx'?: handler }` | One handler per failed call, by exact status then by family, after `notify`. The handler receives `{ error, driver, resource, method }`. See [React to statuses](/nexdk/guides/react-to-statuses/). |
| `throw?` | `boolean` | Off by default. With `true`, a call resolves the bare value and rejects with the error. |
| `validateResponses?` | `boolean` | Off by default. Validates the answers of `get`, `find`, `create` and `update` against the resource schema. See [Validating responses](/nexdk/guides/standard-schema/#validating-responses-opt-in). |

The call proxy is described in [Anatomy of a call](/nexdk/guides/anatomy-of-a-call/).

## `defineSdkConfig(config)`

```ts
function defineSdkConfig<const TDrivers, const TResources, const TThrow extends boolean = false>(
  config: SdkConfig<TDrivers, TResources> & { throw?: TThrow }
): DefinedSdkConfig<TDrivers, TResources, TThrow>
```

Returns `config` unchanged. Use it for a config written apart from `createSdk` (a config file, the `@nexdk/nuxt` module): a plain object widens `throw: true` to `boolean`, and the call types would announce `{ data, error }` while the calls throw.

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

`definition` is `{ name, setup: (config) => state, methods, reactive? }`. A method receives `(ctx, payload, options)`, `options` being `SdkCallOptions | undefined`. `reactive` lists the methods that return an unsubscribe function; the driver exposes them as `reactiveMethods` and `createSdk` rethrows their synchronous throw instead of resolving it. See [Writing a driver](/nexdk/guides/writing-a-driver/).

## Call option helpers

```ts
function anySignal(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined
function callSignal(options: SdkCallOptions | undefined): AbortSignal | undefined
function mergeHeaders(base?: Record<string, string>, extra?: Record<string, string>): Record<string, string>
function failureKind(error: unknown, signal: AbortSignal | undefined): SdkErrorKind
```

Pure functions shared by the drivers. `anySignal` combines the given signals (`AbortSignal.any`), `callSignal` combines the call `signal` with an `AbortSignal.timeout` of the call `timeout`, `mergeHeaders` sets `extra` over `base` case-insensitively, `failureKind` tells `timeout`, `abort` and `network` apart from the aborted signal, then from the error name.

## `traceCall(call, run)`

```ts
function traceCall<T>(call: { emit, resource, method?, payload, describeError? }, run: () => T): T
```

Emits `request` (`{ resource, method, payload }`), runs `run`, then emits `success` (`{ resource, method, data }`) or `error` (the error payload plus `resource` and `method`) once. `method` is omitted from the payloads when not given. `defineDriver` uses it; a hand-written driver wraps each method in it.

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
  readonly kind: SdkErrorKind | undefined
  constructor(message: string, init?: { status?: number; errors?: unknown; data?: unknown; kind?: SdkErrorKind; cause?: unknown })
}

function toErrorPayload(error: unknown): { message: string; status?: number; errors?: unknown; kind?: SdkErrorKind }
```

The typed error thrown by every driver. `toErrorPayload` builds the `error` event payload: `status` when the error has a numeric `status`, `errors` from `error.errors`, else `error.data` for an error with a status, `kind` when the error has a string `kind`. See [Events](/nexdk/guides/events/#error-payload).

## Types

| Type | Role |
|------|------|
| `StandardSchemaV1` | The [Standard Schema](/nexdk/guides/standard-schema/) contract. |
| `SdkDriver` | `{ name, bindResource(name, resource) }`. |
| `SdkConfig` | The argument of `createSdk`. |
| `SdkEvent` | `'request' \| 'success' \| 'error' \| 'data' \| 'complete' \| 'connected' \| 'disconnected'`. |
| `SdkEventHandler` | `(event: SdkEvent, data?: unknown) => void`. |
| `Resource`, `AnyResource`, `ResourceConfig`, `ResourceMap` | The object returned by `defineResource`, and its config. |
| `WriteInput<T>` | `Partial<T> & Record<string, unknown>`: the type of a write body (`create` of the REST drivers, `attributes` of lomkit `mutate`). Schema fields stay typed, fields the resource does not return (a `password`) are accepted. |
| `InferSchema<TResource>` | The inferred record type of a resource. |
| `AsyncMethod`, `ReactiveMethod` | Signatures of a driver method. |
| `DriverDefinition`, `DriverMethod`, `DriverMethodContext`, `DefinedDriver` | Types behind `defineDriver`. |
| `HeadersResolver` | A record, or a function returning one. |
| `FetchLike` | `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`: the type of the `fetch` option of the REST drivers. Narrower than `typeof fetch`, so `mock.fetch` and the `fetch` of bun-types are accepted without a cast. |
| `ErrorEventPayload`, `SdkErrorInit` | The `error` event payload `{ message, status?, errors?, kind?, resource?, method? }`, and the init of `SdkError`. |
| `RequestEventPayload`, `SuccessEventPayload` | `{ resource, method?, payload }` and `{ resource, method?, data }`. |
| `SdkErrorKind` | `'timeout' \| 'abort' \| 'network' \| 'http'`. |
| `SdkCallOptions` | `{ signal?, timeout?, headers? }`: the third argument of a resource method. |
| `ResponseHook`, `ResponseRequest` | `(response, { url, method }) => void \| Promise<void>`: the `onResponse` option of the HTTP drivers. |
| `StatusHandlers`, `StatusHandler`, `StatusContext`, `StatusError` | The `onStatus` option, a handler, the object it receives and its `error`. |
| `SdkResult<T>`, `SdkResultError`, `SdkReturn<TThrow, T>` | The `{ data, error }` union, its error, and `T` or `SdkResult<T>` depending on `throw`. |
| `ResourceApiKinds<T>`, `ThrowingResourceApiKinds<T>` | The registries a driver augments to type its API, by default and with `throw: true`. See [End-to-end typing](/nexdk/guides/writing-a-driver/#end-to-end-typing). |
| `ResourceApiFor`, `ResourceApiUri`, `TypedSdk`, `Sdk`, `ResourcesByDriver` | Types behind the typed SDK. |

## `ResponseValidationError`

```ts
class ResponseValidationError extends SdkError {
  constructor(resourceName: string, errors: Record<string, string[]>, data: unknown)
}
```

Thrown when `validateResponses` is on and an answer does not match the schema: `status` is 0, `errors` is keyed by dotted path (`1.name` for the second row, `data.0.name` inside a `data` envelope, `_` for the root), `data` is the raw answer. See [Validating responses](/nexdk/guides/standard-schema/#validating-responses-opt-in).
