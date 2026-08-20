# frdspuzi.github.io — Claude Code Instructions

You are assisting with Mohammad Firdaus bin Mohd Puzi's personal portfolio/blog site — a Vite + React + TypeScript app living in `component-lab/`, deployed to frdspuzi.github.io via a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds `component-lab/` and deploys it through GitHub Pages' "GitHub Actions" source mode.

## History — the Jekyll site is retired
This repo used to run a Jekyll site from the root (`_includes/`, `_layouts/`, `assets/styles.scss`, etc.). `component-lab/` started as a from-scratch parallel rewrite, was eventually judged to have full feature parity, and GitHub Pages was cut over to serve it instead. The Jekyll source files, `DESIGN.md`, and the root `.ai/` docs that described that stack have all been removed — `component-lab/` is now the only site. If you find a stray reference to `_includes/`, Liquid syntax, or Jekyll front matter anywhere, it's stale and safe to ignore or clean up.

**Still shared with the old pipeline, not Jekyll-specific**: `_data/*.json` (imported directly by `component-lab/src` — one source of truth, not duplicated), `_posts/*.md` (same, imported via Vite's `?raw`), and `assets/{photography,youtube-thumbnails,medium-images}/` (synced into `component-lab/public/assets/` by `component-lab/scripts/sync-assets.js`, which runs automatically via `predev`/`prebuild` — never committed there, so there's only ever one real copy). All of this is written by `.github/scripts/*.js`, scheduled by the workflows in `.github/workflows/*.yml` — none of that changed with the Jekyll cutover.

## Personal profile
`PROFILE.md` at the repo root (gitignored — never commit it) is the site owner's real interest/background profile, built from actual signal (a Google Takeout export), not guesswork. Any content-curation prompt (the YouTube curator, and any future personalized feature) should pull from it instead of hand-writing a fresh "who this is for" description each time. If the file is missing, ask the user before reconstructing it from scratch — it was deliberately built to exclude some real-but-irrelevant or sensitive patterns found in the source data, so a naive rebuild could reintroduce noise it was designed to filter out.

## Context-Driven Development
Before making any code change, read [component-lab/.ai/architecture.md](component-lab/.ai/architecture.md) and [component-lab/.ai/handoff.md](component-lab/.ai/handoff.md). They hold the current architectural rules, data/automation pipeline, and the state of each homepage feature. Re-check them if it's been a while since you last read them in this session — they get updated between sessions.

**After any structural, design, or logic change, update `component-lab/.ai/handoff.md`** with what changed before ending the session, so the next session starts from accurate state instead of stale assumptions.

## Environment & Workflow Rules
- **Shell is PowerShell**, not bash — chain commands with `;`, not `&&`.
- **This repo has GitHub Actions that commit back to `master`** (Unsplash photos twice daily, AI content daily, all committing with `[skip ci]`). Before `git push`, always sync first: `git fetch origin; git pull --rebase origin master`.
- `deploy-pages.yml` triggers on `workflow_run` for every content-writing workflow (not just `push`) specifically because `[skip ci]` in their commits would otherwise suppress a normal push-triggered deploy — see that workflow's own comments before changing its trigger.
- **Conventional commits only**: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- If a task touches `.github/workflows/*.yml`, tell the user first — pushing workflow file changes requires a PAT with the `workflow` scope.
- Gemini's free tier is rate-limited. Any script calling it needs a waterfall fallback (try the strongest model, degrade to a lighter one on `429`/`503`) — see the existing pattern in `.github/scripts/*.js`.
- GitHub Pages' **Source** setting (repo Settings → Pages → Build and deployment) must stay on **"GitHub Actions"**, not "Deploy from a branch" — the latter would silently revert the live site back to trying to build the (now-removed) Jekyll files. This is a web-UI-only setting; it can't be changed via git.

## Coding Philosophy
- Don't over-engineer data structures for documentation's sake (e.g. turning a plain string array into objects just to hold an unused key). Prefer simple, self-documenting code.
- Match the codebase's existing conventions (per-component styling, the established hooks in `component-lab/src/hooks/`) rather than introducing a new methodology for one feature.

## Writing Tone (site copy, blog drafts, prose)
Avoid AI-slop clichés ("It turns out", "magical things happen", "In a world where..."). Write in an authentic, blunt, conversational voice — a mid-20s Malaysian software engineer's — with local flavor (teh tarik, Fajr, rezeki) when it's actually contextually relevant, not forced.

## Link Hygiene
When sourcing external links or citations, verify they resolve and prefer stable domains (Wikipedia, Sunnah.com). Avoid obscure university/journal domains prone to 403s, paywalls, or link rot.
