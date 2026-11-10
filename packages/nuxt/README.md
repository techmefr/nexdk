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
})
```

```ts
import { lomkit } from '@nexdk/driver-lomkit'

export default {
  drivers: { lomkit: lomkit({ baseUrl: 'https://api.example.com' }) },
}
```

The config lives in `sdk.config.ts` at the root of the app (`nexdk: { sdk: '~/other/path' }` to move it). Its default export is an `SdkConfig`, or a function `(nuxtApp) => SdkConfig` to read the runtime config or the request.

```ts
const { data, error } = await useSdk().lomkit.users.search({})
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/packages/nuxt/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/nuxt)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
