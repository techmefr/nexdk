# @nexdk/driver-firebase

nexdk driver for the Cloud Firestore REST API: converts Firestore typed values to plain records.

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
pnpm add nexdk @nexdk/http @nexdk/driver-firebase
```

## Usage

```ts
import { createSdk } from 'nexdk'
import { createFirebaseDriver } from '@nexdk/driver-firebase'

const sdk = createSdk({
  drivers: { firebase: createFirebaseDriver({ projectId: 'my-project' }) },
})

const { data: todos } = await sdk.firebase.todos.get({ orderBy: 'title' })
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/firebase/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/firebase)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
