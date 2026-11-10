---
title: '@nexdk/nuxt'
description: Nuxt module for nexdk — useSdk() and $sdk from one config file.
---

The module builds the SDK from one config file, provides it as `$sdk` and auto-imports `useSdk()` and `defineSdkConfig()`. The SDK is typed from the config.

## Install

Not published to npm yet. Build it from [the repository](https://github.com/techmefr/nexdk) (`packages/nuxt`). It depends on `@nuxt/kit` and peer-depends on `nexdk` and `nuxt` 4.

Once published, install the package with everything it needs:

```bash
pnpm add nexdk nuxt @nexdk/nuxt
```

Add the drivers you use (`@nexdk/driver-lomkit`, ...) and your schema library (`zod` below).

## Usage

```ts
export default defineNuxtConfig({
  modules: ['@nexdk/nuxt'],
  runtimeConfig: { public: { apiUrl: 'https://api.example.com' } },
})
```

`app/sdk.config.ts`:

```ts
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { defineResource, defineSdkConfig } from 'nexdk'
import type { NuxtApp } from '#app'
import { z } from 'zod'

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

export default (nuxtApp: NuxtApp) => defineSdkConfig({
  drivers: { lomkit: new LomkitDriver({ baseUrl: nuxtApp.$config.public.apiUrl }) },
  resources: { lomkit: { users } },
})
```

```ts
const { data, error } = await useSdk().lomkit.users.get({ search: { limit: 10 } })
```

- **Config file**: `~/sdk.config` by default, that is `app/sdk.config.ts` with the Nuxt 4 layout (`~` is the `srcDir`). Set `nexdk: { sdk: '~/path/to/config' }` in `nuxt.config` to move it. A missing file stops the build with the expected path and the name of the option.
- **Function or object**: export a function (sync or async) that receives the `nuxtApp`. It runs once per Nuxt app, so in SSR every request gets its own SDK and its own drivers, `notify` and `onStatus` state, and can read the request or the runtime config. An exported object is evaluated once per server process: its drivers and handlers are shared by every request, and each request binds the resources to them again. Use an object only for stateless drivers.
- **`defineSdkConfig`**: an identity helper from `nexdk`, auto-imported by the module. It keeps the literal type of `throw: true`; a plain object widens it to `boolean` and the types would announce `{ data, error }` while the calls throw.
- **`useSdk()`** and **`$sdk`** (in templates and through `useNuxtApp()`) return the same SDK, typed with `TypedSdk` from the config: drivers, resources and `throw`.
