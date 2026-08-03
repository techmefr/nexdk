---
title: Packages overview
description: What each package in the workspace does and depends on.
---

This workspace is split into composable, UnJS-style building blocks — each usable on its own. See each package's own page for install/usage details.

| Package | Role | Depends on |
|---------|------|------------|
| `nexdk` | The SDK: `createSdk`, `defineResource`, `defineDriver`, proxy + end-to-end inferred types — see the [API reference](/nexdk/reference/nexdk/) | **nothing** |
| [`beepr`](/nexdk/packages/beepr/) | Event engine: `createNotify`, adapters, `mergeEventHandlers` | `hookable` |
| [`chaff`](/nexdk/packages/chaff/) | Schema-driven mock: `parseMock`/`parseMockList`, optional MirageJS server | **nothing** (`miragejs` optional peer) |
| [`@nexdk/http`](/nexdk/packages/http/) | Shared REST toolkit: `request`/`HttpError` (over `ofetch`), `toQuery`/`splitId`, re-exports `resolveHeaders` | `nexdk` (peer), `ofetch` |
| [`@nexdk/driver-lomkit`](/nexdk/drivers/lomkit/) | REST driver (Laravel + Lomkit: `search`/`mutate`/`delete`) | `nexdk` (peer), `chaff`, `@nexdk/http` |
| [`@nexdk/driver-nhost`](/nexdk/drivers/nhost/) | GraphQL + subscriptions driver (Hasura, graphql-transport-ws) | `nexdk` (peer) |
| [`@nexdk/driver-supabase`](/nexdk/drivers/supabase/) | Realtime driver (`postgres_changes`) | `nexdk` (peer), `@supabase/supabase-js` |
| [`@nexdk/driver-nest`](/nexdk/drivers/nest/) | Conventional REST CRUD driver (common NestJS controller shape) | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-symfony`](/nexdk/drivers/symfony/) | REST driver for Symfony / API Platform (Hydra, merge-patch) | `nexdk` (peer), `@nexdk/http` |
| `@nexdk/hooks` | `useResourceForm` (Vue forms + Zod validation) | `nexdk`, `vue`, `zod` (peers) |

## The independence rule

The core tools (`nexdk`, `beepr`, `chaff`) depend on nothing else in the workspace — `nexdk` and `chaff` have **zero** dependencies, validator and framework-agnostic through [Standard Schema](https://standardschema.dev) rather than hardcoding Zod. `@nexdk/hooks` is the one exception: its Vue form helper reads Zod's own shape/default-value internals, so it peer-depends on `zod` directly.

Extensions (drivers, hooks) **peer-depend on `nexdk` only** — you bring the SDK, they don't bundle it, like an ESLint/Vite plugin. Each package builds, tests and ships on its own.

## Naming

Official drivers are `@nexdk/driver-*`; community drivers are `nexdk-driver-*`. To start your own, clone `packages/driver-template` and rename it — see [Writing a driver](/nexdk/guides/writing-a-driver/).
