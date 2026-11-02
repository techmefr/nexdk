# AGENT.md — @nexdk/driver-symfony

## Role
API Platform (Symfony) driver over Hydra / JSON-LD: `get`, `find`, `create`, `update`, `remove` on `/{resource}` and `/{resource}/{id}`. Exposes `createSymfonyDriver(config)` and `symfonyDriver`. Built with `defineDriver`.

## API Platform specifics
- `get` returns `hydra:member`, else `member`, else the body. One request, no page following.
- `update` sends `Content-Type: application/merge-patch+json`. `create` and the other calls send `application/ld+json`. Every request sends `Accept: application/ld+json`. `headers` can override them.
- The resource name and the id are URL-encoded.

## Dependency rule
- `nexdk`: `peerDependency` (+ devDependency `workspace:*`).
- `@nexdk/http`: real `dependency`. `unwrapCollection` stays local, it is Hydra-specific.
- Typing: `declare module 'nexdk'` + `__apiUri: 'symfony'`.

## Contract
Errors: `error` with `{ message, status, errors }`, then an `HttpError` (an `SdkError` with `status`, `errors`, `data`) is thrown. `config.fetch` (optional) is given to `createRequest` and kept in the driver state as `ctx.request`: always call `ctx.request`, never the global `request`.

## Build/test
`pnpm --filter @nexdk/driver-symfony build` · `... test`. Tests stub the global `fetch` and inject one through `config.fetch` (`test/fetch-and-errors.test.ts`).
