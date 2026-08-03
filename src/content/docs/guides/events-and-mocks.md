---
title: Events and mocks
description: The unified event contract and how mocking short-circuits the network.
---

## Events

Every call emits a subset of `request · success · error · data · connected · disconnected` — async methods emit `request`/`success`/`error`; reactive (subscribe-style) methods emit `data`/`connected`/`disconnected` instead, with no `success` envelope around them.

A driver author never emits these by hand: `defineDriver`'s wrapper does it for every method, following one rule — **emit `'error'` then `throw`** on any failure (network, non-2xx HTTP, validation). This is the load-bearing contract every driver must respect.

```ts
sdk.lomkit.users.get({ id: 1 }, (event, data) => {
  // event: 'request' | 'success' | 'error' | ...
})
```

A global `notify` (passed to `createSdk`) and a per-call `notify` both fire — [beepr](https://www.npmjs.com/package/beepr)'s `mergeEventHandlers` combines them, it never replaces one with the other.

## Mocks

The third argument to any call, `mock`, short-circuits the network entirely — the driver returns the mock value directly, still validated by the resource's schema through [chaff](https://www.npmjs.com/package/chaff)'s `parseMock`/`parseMockList`.

```ts
await sdk.lomkit.users.get({ id: 1 }, undefined, { id: 1, name: 'Alice', email: 'a@test.com' })
// no network call — the mock is validated and returned as-is
```

This is what lets every playground app run against a real UI without a live backend, and what a driver's own test suite mocks against instead of the network.
