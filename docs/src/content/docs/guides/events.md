---
title: Events
description: The unified event contract every driver follows.
---

Every call emits a subset of `request · success · error · data · connected · disconnected` — async methods emit `request`/`success`/`error`; reactive (subscribe-style) methods emit `data`/`connected`/`disconnected` instead, with no `success` envelope around them.

A driver author never emits these by hand: `defineDriver`'s wrapper does it for every method, following one rule — **emit `'error'` then `throw`** on any failure (network, non-2xx HTTP, validation). This is the load-bearing contract every driver must respect.

```ts
sdk.lomkit.users.get({ id: 1 }, (event, data) => {
  // event: 'request' | 'success' | 'error' | ...
})
```

A global `notify` (passed to `createSdk`) and a per-call `notify` both fire — `createSdk` merges them internally (both are invoked, in order; neither replaces the other). The event types (`SdkEvent`, `SdkEventHandler`) are exported straight from `nexdk` core — no extra dependency needed to type a handler. [`beepr`](https://www.npmjs.com/package/beepr) is a separate, standalone notify engine with a compatible shape, useful if you want the same event vocabulary outside an `nexdk` SDK.
