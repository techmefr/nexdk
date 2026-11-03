---
title: Packages overview
description: What each package in this workspace does and depends on.
---

The workspace is split into small packages, each usable on its own. None is published to npm yet: build them from the [repository](https://github.com/techmefr/nexdk).

| Package | Role | Depends on |
|---------|------|------------|
| `nexdk` | The SDK: `createSdk`, `defineResource`, `defineDriver`, `resolveHeaders` and the types. See the [API reference](/nexdk/reference/nexdk/). | nothing |
| [`@nexdk/http`](/nexdk/packages/http/) | REST toolkit: `request`, `createRequest`, `HttpError`, `toQuery`, `splitId`, `encodeId`. | `nexdk` (peer) |
| [`@nexdk/hooks`](/nexdk/packages/hooks/) | `useResourceForm` (Vue forms with Zod). | `nexdk`, `vue`, `zod` 3 or 4 (peers) |
| [`@nexdk/repository`](/nexdk/packages/repository/) | One `list`, `find`, `create`, `update`, `remove` interface and a normalised page over lomkit, pocketbase, strapi, nest and symfony. | `nexdk` (peer), the drivers you use (optional peers) |
| [`@nexdk/driver-lomkit`](/nexdk/drivers/lomkit/) | Laravel + Lomkit (`search`, `mutate`, `delete`). | `nexdk`, `@nexdk/http` (peers) |
| [`@nexdk/driver-nhost`](/nexdk/drivers/nhost/) | Hasura GraphQL and subscriptions. | `nexdk` (peer) |
| [`@nexdk/driver-supabase`](/nexdk/drivers/supabase/) | Supabase queries and `postgres_changes`. | `nexdk`, `@supabase/supabase-js` (peers) |
| [`@nexdk/driver-nest`](/nexdk/drivers/nest/) | Conventional REST CRUD (NestJS). | `nexdk`, `@nexdk/http` (peers) |
| [`@nexdk/driver-symfony`](/nexdk/drivers/symfony/) | Symfony / API Platform (Hydra). | `nexdk`, `@nexdk/http` (peers) |
| [`@nexdk/driver-pocketbase`](/nexdk/drivers/pocketbase/) | PocketBase records API. | `nexdk`, `@nexdk/http` (peers) |
| [`@nexdk/driver-strapi`](/nexdk/drivers/strapi/) | Strapi v5 REST. | `nexdk`, `@nexdk/http` (peers) |
| [`@nexdk/driver-firebase`](/nexdk/drivers/firebase/) | Cloud Firestore REST. | `nexdk`, `@nexdk/http` (peers) |

## The independence rule

The `nexdk` core depends on nothing: no validator, no event library, no mock engine. `@nexdk/hooks` is the one exception, because it reads Zod internals.

Extensions peer-depend on `nexdk` only: you bring the SDK, they do not bundle it.

## Outside the workspace

[beepr](https://github.com/techmefr/beepr), [shamock](https://github.com/techmefr/shamock) and [dialectr](https://github.com/techmefr/dialectr) live in their own repositories. nexdk depends on none of them. See [Ecosystem](/nexdk/guides/ecosystem/).

## Naming

Official drivers are `@nexdk/driver-*`. Community drivers are `nexdk-driver-*`. See [Writing a driver](/nexdk/guides/writing-a-driver/).
