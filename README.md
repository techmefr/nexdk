# nexdk docs

Documentation site for [`nexdk`](../packages/nexdk) — built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

Covers the core concepts (call grammar, driver contract, Standard Schema), one page per package (`beepr`, `chaff`, `@nexdk/http`), one page per official driver (`lomkit`, `nhost`, `supabase`, `nest`, `symfony`), a guide to writing your own driver, and the `nexdk` API reference.

## Develop

```bash
pnpm --filter docs dev
```

Site runs at `http://localhost:4321` (or the port set in `.claude/launch.json` if launched that way).

## Build

```bash
pnpm --filter docs build
```

Static output goes to `docs/dist`.

## Deploy

Pushes to `main` that touch `docs/**` are built and deployed to GitHub Pages automatically by [`.github/workflows/docs.yml`](../.github/workflows/docs.yml). Live at `https://techmefr.github.io/nexdk/` (base path `/nexdk`, set in `astro.config.mjs` — kept in sync with the eventual dedicated `nexdk` repo).
