# nexdk

Driver-based SDK. Talk to REST, GraphQL and WebSocket backends through **one
resource grammar** — the calling code never knows which protocol is behind a
resource.

```
sdk.[driver].[resource].[method](payload?, onEvent?, mock?)
```

## Install

```bash
pnpm add nexdk beepr zod
# plus the driver(s) you need, e.g. @pilota/driver-lomkit
```

## Usage

```ts
import { createPilota, defineResource } from 'nexdk'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ id: z.number(), name: z.string(), price: z.number() }),
})

const sdk = createPilota({
  drivers: { lomkit },                 // any object implementing PilotaDriver
  resources: { lomkit: { products: product } },
})

// Fully typed: return type carries z.infer<product.schema>
const { data } = await sdk.lomkit.products.get({})
```

- **`defineResource({ name, schema, fragments?, relations? })`** — declare a
  resource once (Zod schema is the single source of truth).
- **`createPilota({ drivers, resources?, notify? })`** — binds resources to
  drivers and returns a typed SDK. The event handler is structural, so an event
  layer (e.g. [`beepr`](https://www.npmjs.com/package/beepr)) is optional.
- **`mock`** (3rd method arg) — a `T | T[]` short-circuit, validated against the
  resource schema. Pairs well with [`chaff`](https://www.npmjs.com/package/chaff).

## License

MIT © techmefr
