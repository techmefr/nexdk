# @nexdk/nuxt

Nuxt module for nexdk: `useSdk()` and `$sdk` built from one config file, typed from it, in SSR and on the client.

Part of [nexdk](https://github.com/techmefr/nexdk).

## Install

Not published to npm yet. Clone the repository and build it:

```bash
git clone https://github.com/techmefr/nexdk.git
cd nexdk
pnpm install
pnpm build
```

Once published, install the package with everything it needs:

```bash
pnpm add nexdk nuxt @nexdk/nuxt
```

## Usage

```ts
export default defineNuxtConfig({
  modules: ['@nexdk/nuxt'],
  runtimeConfig: { public: { apiUrl: 'https://api.example.com' } },
})
```

`app/sdk.config.ts` (the default `~/sdk.config`; `nexdk: { sdk: '~/other/path' }` moves it):

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

Export a function: it runs once per Nuxt app, so every SSR request gets its own drivers, `notify` and `onStatus`. An exported object is created once per server process and shared by every request. `defineSdkConfig` (auto-imported) keeps `throw: true` literal, so the types match the runtime.

## Documentation

- [Reference](https://techmefr.github.io/nexdk/packages/nuxt/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/nuxt)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
