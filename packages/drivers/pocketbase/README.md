# @nexdk/driver-pocketbase

nexdk driver for the PocketBase records API, with filter, sort and pagination.

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
pnpm add nexdk @nexdk/http @nexdk/driver-pocketbase
```

## Usage

```ts
import { createSdk } from 'nexdk'
import { createPocketbaseDriver } from '@nexdk/driver-pocketbase'

const sdk = createSdk({
  drivers: { pocketbase: createPocketbaseDriver({ baseUrl: 'http://127.0.0.1:8090' }) },
})

const posts = await sdk.pocketbase.posts.get({ sort: '-created' })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/pocketbase/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/pocketbase)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
