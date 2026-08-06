# frdspuzi.github.io — Claude Code Instructions

You are assisting with Mohammad Firdaus bin Mohd Puzi's personal Jekyll portfolio/blog site.

## Branches — check which one you're on first
This repo currently has two active branches with fundamentally different stacks. Run `git rev-parse --abbrev-ref HEAD` before trusting any doc below.
- **`master`** — the live Jekyll site, deploys to frdspuzi.github.io via GitHub Pages. The rest of this file, and the root `.ai/`/`DESIGN.md`, describe this branch.
- **`feat/component-lab`** — a from-scratch Vite + React + TypeScript full-site port living in `component-lab/`, not yet deployed, not yet pushed to origin. It has its own `.ai/architecture.md` and `.ai/handoff.md` inside `component-lab/.ai/` — read those instead when working there, not this file's own `.ai/` pointers below.

## Context-Driven Development
Before making any code change, read [.ai/architecture.md](.ai/architecture.md) and [.ai/handoff.md](.ai/handoff.md). They hold the current architectural rules, data/automation pipeline, and the state of each homepage feature. Re-check them if it's been a while since you last read them in this session — they get updated between sessions.

Before any styling change, also check [DESIGN.md](DESIGN.md) — it's the source of truth for colors, typography, spacing, radius/shadow scale, and component patterns. Reuse the values documented there instead of introducing new ones.

**After any structural, design, or logic change, update `.ai/handoff.md`** with what changed before ending the session, so the next session starts from accurate state instead of stale assumptions.

## Environment & Workflow Rules
- **Shell is PowerShell**, not bash — chain commands with `;`, not `&&`.
- **This repo has GitHub Actions that commit back to `master`** (Unsplash photos twice daily, AI content daily). Before `git push`, always sync first: `git stash; git pull --rebase; git stash pop`.
- **Conventional commits only**: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- If a task touches `.github/workflows/*.yml`, tell the user first — pushing workflow file changes requires a PAT with the `workflow` scope.
- Gemini's free tier is rate-limited. Any script calling it needs a waterfall fallback (try the strongest model, degrade to a lighter one on `429`/`503`) — see the existing pattern in `.github/scripts/*.js`.

## Coding Philosophy
- Don't over-engineer data structures for documentation's sake (e.g. turning a plain string array into objects just to hold an unused key). Prefer simple, self-documenting code.
- No new dependency, abstraction, or shared JS file if the existing per-include, vanilla-JS pattern (see `.ai/architecture.md`) already covers it.
- Match the codebase's existing conventions (Primer utility classes, Liquid `{% if site.style == 'dark' %}` branches, `<details>`-based collapsibles) rather than introducing a new methodology for one feature.

## Writing Tone (site copy, blog drafts, prose)
Avoid AI-slop clichés ("It turns out", "magical things happen", "In a world where..."). Write in an authentic, blunt, conversational voice — a mid-20s Malaysian software engineer's — with local flavor (teh tarik, Fajr, rezeki) when it's actually contextually relevant, not forced.

## Link Hygiene
When sourcing external links or citations, verify they resolve and prefer stable domains (Wikipedia, Sunnah.com). Avoid obscure university/journal domains prone to 403s, paywalls, or link rot.
