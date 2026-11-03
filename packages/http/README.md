# @nexdk/http

Shared REST toolkit for nexdk drivers: a JSON `request` over the native `fetch`, the `HttpError` contract, and query-string and id helpers.

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
pnpm add nexdk @nexdk/http
```

## Usage

```ts
import { createRequest } from '@nexdk/http'

const request = createRequest()
const user = await request<{ id: number }>('https://api.example.com/users/1')
```

## Documentation

- [Reference](https://techmefr.github.io/nexdk/packages/http/)
- [Repository](https://github.com/techmefr/nexdk/tree/main/packages/http)
- [Issues](https://github.com/techmefr/nexdk/issues)

## License

MIT
