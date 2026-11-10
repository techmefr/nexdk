---
title: '@nexdk/nuxt'
description: Nuxt module for nexdk — useSdk() and $sdk from one config file.
---

The module builds the SDK from one config file, provides it as `$sdk` and auto-imports `useSdk()`. The SDK is typed from the config, and one SDK is created per Nuxt app, so per request in SSR.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/nuxt`). It depends on `@nuxt/kit` and peer-depends on `nexdk` and `nuxt` 4.

Once published, install the package with everything it needs:

```bash
pnpm add nexdk nuxt @nexdk/nuxt
```

Add the drivers you use (`@nexdk/driver-lomkit`, ...).

## Usage

```ts
export default defineNuxtConfig({
  modules: ['@nexdk/nuxt'],
})
```

`sdk.config.ts`, at the root of the app:

```ts
import { defineResource } from 'nexdk'
import { lomkit } from '@nexdk/driver-lomkit'

export default (nuxtApp) => ({
  drivers: { lomkit: lomkit({ baseUrl: nuxtApp.$config.public.apiUrl }) },
  resources: { users: defineResource({ name: 'users', schema: userSchema }) },
})
```

```ts
const { data, error } = await useSdk().lomkit.users.search({})
```

- **Config file**: `~/sdk.config` by default, `nexdk: { sdk: '~/path/to/config' }` in `nuxt.config` to move it. The default export is an `SdkConfig`, or a function (sync or async) that receives the `nuxtApp`.
- **`useSdk()`** and **`$sdk`** (in templates and through `useNuxtApp()`) return the same SDK, typed with `TypedSdk` from the config: drivers, resources and `throw`.
- **SSR**: the plugin runs on the server and on the client; each Nuxt app gets its own SDK, so handlers registered on one request never see another.
