# nexdk docs

Documentation site for [`nexdk`](..), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

It covers the core concepts (call grammar, events, Standard Schema), the two in-repo packages (`@nexdk/http`, `@nexdk/hooks`), one page per official driver (`lomkit`, `nhost`, `supabase`, `nest`, `symfony`, `pocketbase`, `strapi`, `firebase`), a guide to writing a driver, the `nexdk` API reference, and an [Ecosystem](src/content/docs/guides/ecosystem.md) page (beepr, shamock, dialectr).

## Develop

```bash
pnpm --filter docs dev
```

The site runs at `http://localhost:4321`.

## Build

```bash
pnpm --filter docs build
```

The static output goes to `docs/dist`.

## Deploy

Pushes to `main` that touch `docs/**` are built and deployed to GitHub Pages by [`.github/workflows/docs.yml`](../.github/workflows/docs.yml). The site is live at `https://techmefr.github.io/nexdk/` (base path `/nexdk`, set in `astro.config.mjs`).
