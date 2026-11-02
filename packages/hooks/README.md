# @nexdk/hooks

Vue composables for nexdk resources: `useResourceForm` builds form state, dirty tracking and server-error mapping from a resource Zod schema.

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
pnpm add nexdk vue zod @nexdk/hooks
```

## Usage

```ts
import { defineResource } from 'nexdk'
import { useResourceForm } from '@nexdk/hooks'
import { z } from 'zod'

const product = defineResource({
  name: 'products',
  schema: z.object({ name: z.string().min(1), price: z.number().default(0) }),
})

const { values, errors, isDirty, handleSubmit } = useResourceForm(product)
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/packages/hooks/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/hooks)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
