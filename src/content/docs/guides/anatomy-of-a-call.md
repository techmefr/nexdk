---
title: Anatomy of a call
description: What payload, notify and mock do on every SDK call.
---

```
sdk.[driver].[resource].[method](payload?, notify?, mock?)
                                    │        │       │
                                  data    events   network mock
                                 / filter  (beepr)  (chaff)
```

| Parameter | Type | Role |
|-----------|------|------|
| `payload` | `object` | Search filter, object to create… |
| `notify`  | `SdkEventHandler` | Event callback — built with `createNotify(adapter)` from [beepr](https://www.npmjs.com/package/beepr) |
| `mock`    | `T \| T[]` | Replacement data — short-circuits the network, validated by the schema, via [chaff](https://www.npmjs.com/package/chaff) |

Events emitted: `request · success · error · data · connected · disconnected`.

A global `notify` (passed to `createSdk`) and a per-call `notify` both fire — they are merged, not replaced. See [Events and mocks](/nexdk/guides/events-and-mocks/) for the full contract.
