---
title: beepr
description: A tiny, typed event/notify engine — the SDK's event layer, usable standalone.
---

A tiny, typed event/notify engine. One handler contract, composable adapters,
zero framework lock-in. Built on [`hookable`](https://github.com/unjs/hookable).

Depends on nothing in this workspace but `hookable` — it works with any SDK, not just `nexdk`.

## Install

```bash
pnpm add beepr
```

## Usage

```ts
import { createNotify, mergeEventHandlers } from 'beepr'
import type { SdkEvent, SdkEventHandler } from 'beepr'

// Turn a typed adapter into a raw (event, data) => void handler
const notify = createNotify({
  onRequest: ctx => console.log('→', ctx.resource),
  onSuccess: data => console.log('ok', data),
  onError:   err => console.error(err.message),
  onConnected:    () => {},
  onDisconnected: () => {},
})

// Combine a global handler with a per-call one (both fire)
const handler = mergeEventHandlers(globalNotify, notify)
handler('success', { id: 1 })
```

Events: `request · success · error · data · connected · disconnected`.

- **`createNotify(adapter)`** → `SdkEventHandler`.
- **`mergeEventHandlers(a, b)`** — call both if both are defined.
- **`createSdkHooks()`** — a `hookable` instance typed with the event map.
- **`resolveEventHandler(...)`** — internal helper used by the two above.

Useful on its own as a typed notification bus, or as the event layer for
[`nexdk`](/nexdk/introduction/).
