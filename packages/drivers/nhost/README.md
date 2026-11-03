# @nexdk/driver-nhost

nexdk GraphQL driver for Hasura and nhost: queries, mutations and subscriptions over graphql-transport-ws.

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
pnpm add nexdk @nexdk/driver-nhost
```

## Usage

```ts
import { createSdk, defineResource } from 'nexdk'
import { NhostDriver } from '@nexdk/driver-nhost'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ id: z.string(), name: z.string() }),
})

const sdk = createSdk({
  drivers: { nhost: new NhostDriver({ endpoint: 'https://backend.nhost.run/v1/graphql' }) },
  resources: { nhost: { products: product } },
})

const { data: result } = await sdk.nhost.products.query<{ products: { id: string; name: string }[] }>({ limit: 5 })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/nhost/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/nhost)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
