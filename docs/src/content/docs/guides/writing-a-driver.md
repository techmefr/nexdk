---
title: Writing a driver
description: The runtime contract a driver must follow, and how to author one with defineDriver.
---

A driver translates the call grammar `sdk.[driver].[resource].[method](payload?, onEvent?, extra?)` into a protocol. This guide covers the contract, `defineDriver`, and typing.

## The runtime contract

`createSdk` builds a proxy per driver. A call to `sdk.my.users.get(payload, onEvent, extra)` runs this on the driver object:

```ts
driver.get('users', payload, mergedHandler, extra)
```

Every method has the same signature:

```ts
(resourceName: string, payload?: unknown, onEvent?: SdkEventHandler, extra?: unknown) => unknown
```

`mergedHandler` combines the global `notify` and the per-call `onEvent`. A driver implements two members:

```ts
interface SdkDriver {
  readonly name: string
  bindResource(resourceName: string, resource: AnyResource): void
}
```

`createSdk` calls `bindResource` for every resource declared under the driver's key.

## The event vocabulary

| Event          | When                                          |
|----------------|-----------------------------------------------|
| `request`      | Before the call, with `{ resource, payload }` |
| `success`      | On success, with the result                   |
| `error`        | On failure                                    |
| `data`         | A reactive push (subscription payload)        |
| `connected`    | A reactive transport opened                   |
| `disconnected` | A reactive transport closed                   |

**Emit `error`, then throw.** On any failure a method emits `error` once and throws. It never returns an empty value instead.

## Authoring with defineDriver

`defineDriver` supplies the resource map, `bindResource` and the `request`, `success` and `error` events. You write the protocol translation.

```ts
import { createSdk, defineDriver, resolveHeaders } from 'nexdk'

interface MyConfig {
  baseUrl: string
  headers?: Record<string, string>
}

const createMyDriver = defineDriver({
  name: 'my',
  setup: (config: MyConfig) => ({
    baseUrl: config.baseUrl.replace(/\/$/, ''),
    buildHeaders: async () => ({
      'Content-Type': 'application/json',
      ...(await resolveHeaders(config.headers)),
    }),
  }),
  methods: {
    get: async (ctx) => {
      const response = await fetch(`${ctx.baseUrl}/${ctx.resourceName}`, {
        headers: await ctx.buildHeaders(),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },
})

const sdk = createSdk({
  drivers: { my: createMyDriver({ baseUrl: 'https://api.example.com' }) },
})

const users = await sdk.my.users.get({}, (event) => console.log(event))
```

Every method receives a `ctx`, then the payload and `extra`:

- `resourceName`: the name used in the call (`"users"`);
- `resource`: the bound resource, or `undefined`;
- `emit`: the merged handler, for `data`, `connected` and the like;
- everything returned by `setup`.

The wrapper does this for each method:

1. emits `request` with `{ resource, payload }`;
2. if the body returns a Promise, awaits it, emits `success` and returns the value;
3. if the body throws, emits `error` and rethrows. An error with a numeric `status` (an `SdkError`, such as the `HttpError` of `@nexdk/http`) gives `{ message, status, errors }`, anything else `{ message }`;
4. if the body returns a function, returns it as is. It is the unsubscribe handle of a reactive method, with no `success` or `error` envelope.

### Headers

`headers` is a record or a function called before every request, so a refreshed token is always used:

```ts
type HeadersResolver =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>)
```

`resolveHeaders` is exported from `nexdk` and from `@nexdk/http`.

## Authoring by hand

You can implement `SdkDriver` yourself, as `@nexdk/driver-lomkit` and `@nexdk/driver-supabase` do. You then own the resource map and the event handling of every method. Prefer `defineDriver` unless you need a shape it cannot express. `@nexdk/driver-nest` is the reference.

## End-to-end typing

Typing is opt-in, through a registry in `nexdk`.

Declare the per-resource API, with `T` the inferred record type:

```ts
export interface MyResourceApi<T> {
  get(query?: object, onEvent?: SdkEventHandler): Promise<T[]>
}
```

Register it by declaration merging:

```ts
declare module 'nexdk' {
  interface ResourceApiKinds<T> {
    my: MyResourceApi<T>
  }
}
```

Advertise the key on the driver with `__apiUri`. With `defineDriver`, return the driver from a factory:

```ts
export function createTypedDriver(config: MyConfig): ReturnType<typeof createMyDriver> & { __apiUri: 'my' } {
  return createMyDriver(config) as ReturnType<typeof createMyDriver> & { __apiUri: 'my' }
}
```

By hand, add `declare readonly __apiUri: 'my'` to the class. Without `__apiUri`, calls still work through the untyped proxy.

## Conventions

- Official drivers: `@nexdk/driver-*`. Community drivers: `nexdk-driver-*`.
- `nexdk` goes in `peerDependencies`, plus a `devDependency` so the package builds alone.
- Import the event types from `nexdk`. Do not depend on another driver.
- A library the driver needs at runtime goes in `dependencies` (for example `@nexdk/http`, or `@supabase/supabase-js`).

```json
{
  "peerDependencies": { "nexdk": "workspace:*" },
  "devDependencies": { "nexdk": "workspace:*" }
}
```

## Which drivers use what

`@nexdk/driver-lomkit` and `@nexdk/driver-supabase` are hand-written. `@nexdk/driver-nest`, `symfony`, `pocketbase`, `strapi`, `firebase` and `nhost` use `defineDriver`.
