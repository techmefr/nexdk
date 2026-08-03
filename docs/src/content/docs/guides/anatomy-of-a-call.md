---
title: Anatomy of a call
description: What payload, notify and the driver-opaque extra argument do on every SDK call.
---

```
sdk.[driver].[resource].[method](payload?, notify?, extra?)
                                    │        │       │
                                  data    events   driver-opaque
                                 / filter
```

| Parameter | Type | Role |
|-----------|------|------|
| `payload` | `object` | Search filter, object to create… |
| `notify`  | `SdkEventHandler` | Event callback for this call, merged with any global `notify` passed to `createSdk` |
| `extra`   | `unknown` | Opaque at the core level — most drivers ignore it; a few give it their own meaning (e.g. nhost narrows it to GraphQL fragment-selection options) |

Events emitted: `request · success · error · data · connected · disconnected`.

A global `notify` (passed to `createSdk`) and a per-call `notify` both fire — they are merged, not replaced. See [Events](/nexdk/guides/events/) for the full contract.
