# AGENT.md — @pilota/driver-symfony

## Role
API Platform (Symfony) REST driver over the Hydra / JSON-LD conventions:
`get`/`find`/`create`/`update`/`remove` → GET/POST/PATCH/DELETE on
`/{resource}` and `/{resource}/{id}`. Exposes `createSymfonyDriver(config)`,
`SymfonyResourceApi<T>`, `SymfonyConfig`.

Built WITH `defineDriver` from `nexdk` — the method bodies carry only the
protocol translation; the `request`/`success`/`error` contract is supplied by
the helper (emit-then-throw on a non-OK HTTP status).

## API Platform specifics (vs the plain-REST nest driver)
- **Hydra collection unwrap**: `get` returns `body['hydra:member']` (Hydra
  JSON-LD), falling back to `body.member` (newer serializers) then the body
  itself (plain-array endpoints).
- **merge-patch on update**: `update` sends `Content-Type:
  application/merge-patch+json` — API Platform requires this for `PATCH`. This
  is the meaningful difference from nest, which uses plain `application/json`.
- `create` sends `Content-Type: application/ld+json`; reads use `Accept:
  application/ld+json`. Consumers can override any header via the `headers`
  resolver.

## Dependency rule
- `nexdk` is a **peerDependency** (+ devDependency `workspace:*`), never a
  `dependency`. It uses `defineDriver`/`resolveHeaders` (runtime) and types.
- No `beepr` dependency — the event handler type comes from `nexdk`.
- Declares its typing via `declare module 'nexdk'` + `__apiUri: 'symfony'`.

## Build/test
`pnpm --filter @pilota/driver-symfony build` · `... test`. Tests mock `fetch`.
