# frdspuzi.github.io

Mohammad Firdaus bin Mohd Puzi's personal portfolio/blog site — a Vite + React + TypeScript app in [`component-lab/`](component-lab/), deployed to [frdspuzi.github.io](https://frdspuzi.github.io/) via GitHub Actions (`.github/workflows/deploy-pages.yml`).

## Structure

- **`component-lab/`** — the site itself. See [`component-lab/.ai/architecture.md`](component-lab/.ai/architecture.md) for the tech stack and architectural rules, and [`component-lab/.ai/handoff.md`](component-lab/.ai/handoff.md) for current state.
- **`_data/*.json`, `_posts/*.md`** — content imported directly by `component-lab/src` at build time (one source of truth, not duplicated).
- **`assets/{photography,youtube-thumbnails,medium-images}/`** — fetched images, synced into `component-lab/public/assets/` automatically by `component-lab/scripts/sync-assets.js` before every dev/build.
- **`.github/scripts/*.js`** — Node scripts that fetch Unsplash photos, Medium articles, and AI-generated content (gratitude prompts, learning trivia, YouTube video summaries) into `_data/*.json` and the asset folders above.
- **`.github/workflows/*.yml`** — schedules the fetch scripts and deploys the site. The deploy workflow triggers on `workflow_run` (not just `push`) specifically because the content-fetch workflows commit with `[skip ci]`, which would otherwise suppress a normal push-triggered deploy.

## Local development

```
cd component-lab
npm install
npm run dev
```

## History

This repo used to run a Jekyll site from the root. `component-lab/` started as a parallel Vite/React rewrite and was eventually cut over to be the live deployment (2026-08-12) — the Jekyll source, `DESIGN.md`, and the old root `.ai/` docs have all been removed.
