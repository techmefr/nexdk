---
title: Packages overview
description: What each package in this workspace does and depends on.
---

The workspace is split into small packages, each usable on its own. None is published to npm yet: build them from the [repository](https://github.com/techmefr/nexdk).

| Package | Role | Depends on |
|---------|------|------------|
| `nexdk` | The SDK: `createSdk`, `defineResource`, `defineDriver`, `resolveHeaders` and the types. See the [API reference](/nexdk/reference/nexdk/). | nothing |
| [`@nexdk/http`](/nexdk/packages/http/) | REST toolkit: `request`, `HttpError`, `toQuery`, `splitId`, `encodeId`. | `nexdk` (peer), `ofetch` |
| [`@nexdk/hooks`](/nexdk/packages/hooks/) | `useResourceForm` (Vue forms with Zod). | `nexdk`, `vue`, `zod` (peers) |
| [`@nexdk/driver-lomkit`](/nexdk/drivers/lomkit/) | Laravel + Lomkit (`search`, `mutate`, `delete`). | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-nhost`](/nexdk/drivers/nhost/) | Hasura GraphQL and subscriptions. | `nexdk` (peer) |
| [`@nexdk/driver-supabase`](/nexdk/drivers/supabase/) | Supabase queries and `postgres_changes`. | `nexdk` (peer), `@supabase/supabase-js` |
| [`@nexdk/driver-nest`](/nexdk/drivers/nest/) | Conventional REST CRUD (NestJS). | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-symfony`](/nexdk/drivers/symfony/) | Symfony / API Platform (Hydra). | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-pocketbase`](/nexdk/drivers/pocketbase/) | PocketBase records API. | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-strapi`](/nexdk/drivers/strapi/) | Strapi v5 REST. | `nexdk` (peer), `@nexdk/http` |
| [`@nexdk/driver-firebase`](/nexdk/drivers/firebase/) | Cloud Firestore REST. | `nexdk` (peer), `@nexdk/http` |

## The independence rule

The `nexdk` core depends on nothing: no validator, no event library, no mock engine. `@nexdk/hooks` is the one exception, because it reads Zod internals.

Extensions peer-depend on `nexdk` only: you bring the SDK, they do not bundle it.

## Outside the workspace

[beepr](https://github.com/techmefr/beepr), [shamock](https://github.com/techmefr/shamock) and [dialectr](https://github.com/techmefr/dialectr) live in their own repositories. nexdk depends on none of them. See [Ecosystem](/nexdk/guides/ecosystem/).

## Naming

Official drivers are `@nexdk/driver-*`. Community drivers are `nexdk-driver-*`. See [Writing a driver](/nexdk/guides/writing-a-driver/).
