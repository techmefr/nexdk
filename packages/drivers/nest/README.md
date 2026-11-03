# @nexdk/driver-nest

nexdk driver for the conventional NestJS REST controller shape (GET, POST, PATCH, DELETE).

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
pnpm add nexdk @nexdk/http @nexdk/driver-nest
```

## Usage

```ts
import { createSdk } from 'nexdk'
import { createNestDriver } from '@nexdk/driver-nest'

const sdk = createSdk({
  drivers: { nest: createNestDriver({ baseUrl: 'https://api.example.com' }) },
})

const { data: users } = await sdk.nest.users.get({ page: 1 })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/nest/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/nest)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
