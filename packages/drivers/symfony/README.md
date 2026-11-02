# @nexdk/driver-symfony

nexdk driver for Symfony API Platform (Hydra, JSON-LD and merge-patch).

Part of [nexdk](https://github.com/techmefr/nexdk).

## Install

Not published to npm yet. Clone the repository and build it:

```bash
git clone https://github.com/techmefr/nexdk.git
cd nexdk
pnpm install
pnpm build
```

Peer dependencies: `nexdk`, `@nexdk/http`.

## Usage

```ts
import { createSdk } from 'nexdk'
import { createSymfonyDriver } from '@nexdk/driver-symfony'

const sdk = createSdk({
  drivers: { symfony: createSymfonyDriver({ baseUrl: 'https://api.example.com' }) },
})

const books = await sdk.symfony.books.get({ page: 1 })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/symfony/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/symfony)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
