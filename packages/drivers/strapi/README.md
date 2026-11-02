# @nexdk/driver-strapi

nexdk driver for the Strapi REST API: unwraps the data envelope and builds bracket query strings.

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
pnpm add nexdk @nexdk/http @nexdk/driver-strapi
```

## Usage

```ts
import { createSdk } from 'nexdk'
import { createStrapiDriver } from '@nexdk/driver-strapi'

const sdk = createSdk({
  drivers: { strapi: createStrapiDriver({ baseUrl: 'http://localhost:1337' }) },
})

const articles = await sdk.strapi.articles.get({ filters: { title: { $eq: 'Hello' } } })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/strapi/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/strapi)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
