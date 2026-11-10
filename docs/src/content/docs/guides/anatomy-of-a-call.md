---
title: Anatomy of a call
description: What payload, onEvent and the per-call options do on every SDK call.
---

```
sdk.[driver].[resource].[method](payload?, onEvent?, options?)
```

| Parameter | Type | Role |
|-----------|------|------|
| `payload` | `object` | Filter, query, record to create. Its shape is defined by the driver. |
| `onEvent` | `SdkEventHandler` | Event callback for this call, run together with the global `notify` of `createSdk`. |
| `options` | `SdkCallOptions` | `{ signal?, timeout?, headers? }` for this call only, passed as is to the driver. `headers` and `timeout` win over the driver config; the call `signal` and the driver `signal` are combined (either one aborts). The call `timeout` covers the whole call: every page of a paginated `get` and the reading of the bodies. An aborted call leaves the driver usable. nhost also reads `{ fragment }`; supabase applies `signal` and `headers` to the query. |

Rules of the proxy:

- `driver` is a key of `drivers`. `resource` is any name: it is passed to the driver as the resource name, and bound to the `resources` entry with the same key when there is one.
- `method` must be a method of the driver. An unknown method, like a synchronous throw of the driver, resolves `{ data: undefined, error }` (`Driver "x" has no method "y" for resource "z"`) after `notify` and `onStatus`; with `throw: true` it throws.
- Methods of `Object.prototype` (`toString`, `constructor`...) are not callable through a resource.
- A resource key must not match any member of the driver (`name`, `bindResource`, a method, a private field such as `resources` or `baseUrl`, or an `Object.prototype` name). `createSdk` throws `Resource "x" collides with a member of driver "y" (z): rename the resource key` when it binds the resources.

Events: `request`, `success`, `error`, `data`, `connected`, `disconnected`. See [Events](/nexdk/guides/events/).

## Delete results

A delete resolves what the backend answers when it is useful, else `{ success: true }`.

| Driver | Method | Result |
|--------|--------|--------|
| lomkit | `delete` | The deleted rows, `{ data, meta }`. |
| supabase | `remove` | `{ success: true }` (Postgrest answers no row by default). |
| nest, symfony, pocketbase, strapi, firebase | `remove` | `{ success: true }` (204 or an empty body by convention). |
| nhost | `deleteById` | `{ success: true }`. |
