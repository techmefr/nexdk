# @nexdk/driver-lomkit

nexdk driver for a Laravel backend using the Lomkit REST API: search, mutate (with typed relations), delete, restore, forceDelete, actions, details, gates, and simple field names on 422 errors.

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
pnpm add nexdk @nexdk/http @nexdk/driver-lomkit
```

## Usage

```ts
import { createSdk, defineResource } from 'nexdk'
import { LomkitDriver } from '@nexdk/driver-lomkit'
import { z } from 'zod'

const user = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

const sdk = createSdk({
  drivers: { lomkit: new LomkitDriver({ baseUrl: 'https://api.example.com' }) },
  resources: { lomkit: { users: user } },
})

const { data } = await sdk.lomkit.users.get({ search: { limit: 20, page: 1 } })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/lomkit/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/lomkit)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
