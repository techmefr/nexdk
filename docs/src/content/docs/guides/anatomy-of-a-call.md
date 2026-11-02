---
title: Anatomy of a call
description: What payload, onEvent and the driver-opaque extra argument do on every SDK call.
---

```
sdk.[driver].[resource].[method](payload?, onEvent?, extra?)
```

| Parameter | Type | Role |
|-----------|------|------|
| `payload` | `object` | Filter, query, record to create. Its shape is defined by the driver. |
| `onEvent` | `SdkEventHandler` | Event callback for this call, run together with the global `notify` of `createSdk`. |
| `extra`   | `unknown` | Opaque to the core. Most drivers ignore it; nhost reads `{ fragment }` from it. |

Rules of the proxy:

- `driver` is a key of `drivers`. `resource` is any name: it is passed to the driver as the resource name, and bound to the `resources` entry with the same key when there is one.
- `method` must be a method of the driver. An unknown method throws `Driver "x" has no method "y" for resource "z"`.
- Methods of `Object.prototype` (`toString`, `constructor`...) are not callable through a resource.
- A resource key must not match any member of the driver (`name`, `bindResource`, a method, a private field such as `resources` or `baseUrl`, or an `Object.prototype` name). `createSdk` throws `Resource "x" collides with a member of driver "y" (z): rename the resource key` when it binds the resources.

Events: `request`, `success`, `error`, `data`, `connected`, `disconnected`. See [Events](/nexdk/guides/events/).
