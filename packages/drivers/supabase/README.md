# @nexdk/driver-supabase

nexdk driver for Supabase: table reads and writes and postgres_changes realtime channels, over @supabase/supabase-js.

Part of [nexdk](https://github.com/techmefr/nexdk).

## Install

Not published to npm yet. Clone the repository and build it:

```bash
git clone https://github.com/techmefr/nexdk.git
cd nexdk
pnpm install
pnpm build
```

Peer dependencies: `nexdk`, `@supabase/supabase-js`.

## Usage

```ts
import { createSdk } from 'nexdk'
import { SupabaseDriver } from '@nexdk/driver-supabase'

const sdk = createSdk({
  drivers: { supabase: new SupabaseDriver({ url: 'https://xyz.supabase.co', key: 'anon-key' }) },
})

const { data } = await sdk.supabase.messages.get()
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/drivers/supabase/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/drivers/supabase)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
