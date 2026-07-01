# Writing a driver

A Pilota driver translates the uniform call grammar
`sdk.[driver].[resource].[method](payload?, notify?, mock?)` into a concrete
protocol (REST, GraphQL, WebSocket…). This guide covers the runtime contract,
how to author a driver with `defineDriver` (recommended) or by hand, and how to
add end-to-end typing.

## The runtime contract

`createPilota` builds a proxy per driver. When you call
`sdk.myDriver.users.get(payload, onEvent, mock)` it invokes, on the driver
object:

```ts
driver.get('users', payload, mergedHandler, mock)
```

So every method has the same **proxy signature**:

```ts
(resourceName: string, payload?: unknown, onEvent?: PilotaEventHandler, mock?: unknown) => unknown
```

`mergedHandler` combines the global `notify` (passed to `createPilota`) with the
per-call `onEvent`. A driver only implements two required members:

```ts
interface PilotaDriver {
    readonly name: string
    bindResource(resourceName: string, resource: AnyResource): void
}
```

`createPilota` calls `bindResource` for every resource declared under that
driver's key, so a driver keeps its bound resources in a private `Map`.

## The event vocabulary

Methods emit through the handler. The full vocabulary is:

| Event          | When                                              |
|----------------|---------------------------------------------------|
| `request`      | Before the call, with `{ resource, payload }`     |
| `success`      | On success, with the result                       |
| `error`        | On failure, with `{ message }` (+ any detail)     |
| `data`         | A reactive push (subscription payload)            |
| `connected`    | A reactive transport opened                       |
| `disconnected` | A reactive transport closed                       |

**The emit-then-throw error rule.** On any failure — a non-OK HTTP response, a
thrown exception, a validation error — a method must emit `'error'` **once** and
then **throw**. It must never swallow the error and return an empty/false value.
The `'error'` event carries at least `{ message }`; a driver may add fields
(e.g. lomkit adds a Laravel `errors` map on a 422).

## Authoring with `defineDriver` (recommended)

`defineDriver` (exported from `nexdk`) supplies the whole envelope — the
resource `Map`, `bindResource`, and the `request`/`success`/`error` wrapping —
so you write only the protocol translation.

```ts
import { defineDriver, resolveHeaders } from 'nexdk'

const createMyDriver = defineDriver({
    name: 'my',
    // Build per-driver state from the config; it is spread into every ctx.
    setup: (config: MyConfig) => ({
        baseUrl: config.baseUrl.replace(/\/$/, ''),
        buildHeaders: async () => ({
            'Content-Type': 'application/json',
            ...(await resolveHeaders(config.headers)),
        }),
    }),
    methods: {
        // ctx = { resourceName, resource, emit } + whatever setup returned.
        get: async (ctx, payload) => {
            const res = await fetch(`${ctx.baseUrl}/${ctx.resourceName}`, {
                headers: await ctx.buildHeaders(),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`) // → emit('error') + rethrow
            return res.json()
        },
    },
})

const driver = createMyDriver({ baseUrl: 'https://api.example.com' })
```

The `ctx` every method receives carries:

- `resourceName` — the SDK key used in the call (`"users"`);
- `resource` — the bound `AnyResource | undefined` (use its `.name`, `.schema`);
- `emit` — the merged event handler (call it for `data`/`connected`/… in
  reactive methods; `request`/`success`/`error` are automatic);
- plus every field returned by `setup(config)`.

What the wrapper does automatically for each method:

1. `emit('request', { resource, payload })` before the body runs;
2. if the body returns a **Promise**, it awaits it, then `emit('success', value)`
   and returns the value;
3. if the body **throws** (sync or async), it does `emit('error', { message })`
   then rethrows — you only `throw`, never write the try/catch;
4. if the body returns a **function**, it is treated as a reactive unsubscribe
   handle and returned **as-is** — no success/error envelope. This keeps a
   subscribe-style method's synchronous teardown intact.

### The headers resolver convention

Config `headers` is either a static record or a resolver called before every
request (so a refreshed token is always picked up):

```ts
type HeadersResolver =
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>)
```

`resolveHeaders(headers)` (exported from `nexdk`) awaits the function form. Build
your headers inside `setup` so every method reuses the same resolver.

### Mocks stay author-controlled

The `mock` argument is passed straight to your method as its third parameter.
`nexdk` does not depend on `chaff`; you decide what to do with a mock. A common
pattern is to validate it against the bound resource schema and short-circuit
the network:

```ts
import { parseMockList } from 'chaff'

get: async (ctx, payload, mock) => {
    if (mock !== undefined && ctx.resource) {
        return { data: parseMockList(ctx.resource, mock) }
    }
    // …real fetch…
}
```

## Authoring by hand

You can implement `PilotaDriver` directly (see `@pilota/driver-lomkit`). You then
own the resource `Map`, `bindResource`, and the full
`request` → try/`success` → catch/`error`+throw boilerplate in every method. Use
this only when a driver needs a shape `defineDriver` cannot express; otherwise
prefer `defineDriver`.

## End-to-end typing

Typing is opt-in via a higher-kinded-type registry in `nexdk`. Three steps:

**1. Declare a per-resource API interface**, parameterized by the resource's
inferred record type `T`:

```ts
export interface MyResourceApi<T> {
    get(query?: object, onEvent?: PilotaEventHandler, mock?: T | T[]): Promise<T[]>
    // …one method per driver method, matching the (payload, onEvent, mock) shape…
}
```

**2. Register it in the registry** via declaration merging, keyed by a string
uri:

```ts
declare module 'nexdk' {
    interface ResourceApiKinds<T> {
        my: MyResourceApi<T>
    }
}
```

**3. Advertise the uri on the driver** with a phantom `__apiUri`. `createPilota`
reads it and looks `MyResourceApi<T>` up in the registry, so
`sdk.my.<resource>.get()` is fully typed from the resource's Zod schema. By hand
this is a `declare readonly __apiUri: 'my'` field; with `defineDriver` expose a
factory whose return type intersects `{ __apiUri: 'my' }`:

```ts
export function createMyDriver(config: MyConfig): ReturnType<typeof myDriver> & { __apiUri: 'my' } {
    return myDriver(config) as ReturnType<typeof myDriver> & { __apiUri: 'my' }
}
```

When a driver declares no `__apiUri`, the SDK falls back to the permissive proxy
shape (`sdk.driver.anything.method()` still works, just untyped).

## Publishing conventions

- Official drivers: `@pilota/driver-*` (e.g. `@pilota/driver-nest`).
- Community drivers: `pilota-driver-*`.

Mirror the Tier-3 package metadata (description, `license: MIT`,
`author: techmefr`, `repository` + `directory`, types-first `exports`, `files`,
`publishConfig`, `sideEffects: false`).

## Dependency rule (independence)

A driver **peer-depends on `nexdk`, never depends on it** — the consumer already
has the SDK; your driver must not bundle its own copy (the ESLint/Vite plugin
model). In your `package.json`:

```jsonc
{
  "peerDependencies": { "nexdk": "workspace:*" },     // or a version range once published
  "devDependencies":  { "nexdk": "workspace:*" }       // so the package still builds/tests alone
}
```

- Put `nexdk` in `peerDependencies` (+ a `devDependency` so it builds in isolation).
- Do **not** depend on `beepr` (import the event type from `nexdk`) or on any other
  driver.
- A library your driver genuinely needs at runtime goes in `dependencies`
  (e.g. the supabase driver's `@supabase/supabase-js`, lomkit's `chaff` for the
  mock path); a library the consumer already has goes in `peerDependencies`.

This is the repo-wide independence rule — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Follow-up

The existing hand-written drivers (`lomkit`, `nhost`, `supabase`) predate
`defineDriver` and are not yet migrated onto it — a separate, non-breaking task.
`@pilota/driver-nest` is the reference for the `defineDriver` authoring flow.
