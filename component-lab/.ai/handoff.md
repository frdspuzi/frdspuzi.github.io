# component-lab Handoff Briefing

**To the incoming agent/session:** you're on branch `feat/component-lab`, working on a full Vite + React port of frdspuzi.github.io — a different project from what the repo root's `.ai/handoff.md`/`.ai/architecture.md` describe (the live Jekyll site on `master`). Read `component-lab/.ai/architecture.md` first for the persistent rules (tech stack, the component-sourcing rule, the shared accordion system's hard-won invariants), this file for current state.

**This repo currently has two live branches with fundamentally different stacks — don't assume you're on the one you expect:**
- `master` — the live Jekyll site, deploys to frdspuzi.github.io via GitHub Pages. Its own `.ai/architecture.md`/`.ai/handoff.md` at the repo root apply there.
- `feat/component-lab` — this branch. A from-scratch Vite + React + TypeScript port living in `component-lab/`, not yet deployed anywhere, not yet pushed to origin. Its own `.ai/` pair (this directory) applies here.
Run `git rev-parse --abbrev-ref HEAD` if in doubt before trusting either pair of docs.

## Status (2026-08-06 session end)

**Scope:** full site port, eventual goal of replacing Jekyll as the live deploy. Deployment cutover itself is explicitly deferred — see architecture.md's "Not Yet Decided" section.

**Built and committed, in order:**
1. App shell — routing (`react-router-dom`, home + post routes), Primer CSS + site.scss import, theme toggle, layout.
2. Shared accordion system — `Accordion.tsx` / `useAccordionGroup.tsx` / `useAnimatedDisclosure.ts`. See architecture.md's 4 hard-won invariants before touching any of these three files.
3. Masthead — avatar, name/bio, location, GitHub/LinkedIn social icons with the touch-tap fill/tooltip reveal. `src/data/user.ts` snapshots `jekyll-github-metadata`'s live GitHub API values from the last Jekyll build (no build-time GitHub fetch here) — update by hand if the GitHub profile changes.
4. Gratitude journal — textarea + AI-suggestion typewriter effect, own (non-groupable) disclosure that still participates in mobile single-open.
5. YouTube feed ("Reclaiming the Algo") — the swipe carousel (3-slide prev/current/next viewport, axis-locked drag, YouTube IFrame API facade pattern). `YoutubeCarousel.tsx` is imperative-refs style, see architecture.md's Component Conventions.
6. Insights & Writing — Medium card tray (`MediumTray.tsx`, real JSX cards) + AI trivia swipe carousel (`TriviaBoard.tsx`, same imperative pattern as YoutubeCarousel). `activeFilter` lifted to `InsightsWriting.tsx`, replacing the original's `window.filterTrivia` global.

**Not yet started:**
- Photography section (the Infinite Image Field canvas gallery) — likely the largest remaining piece, genuinely not begun.
- Floating Preview Rail nav — `@beui/preview-rail` looks like a plausible real-component fit by name/description, not yet actually tried; check it properly before hand-porting `floating_toc.html`.
- A dedicated data-wiring pass to confirm nothing was left on placeholder/smoke-test data (most sections are already wired to real `_data/*.json`, but this hasn't been double-checked end to end).
- Blog post route + layout (`_layouts/post.html`'s equivalent; the one real post is `_posts/2019-01-29-hello-world.md`).

## Recent Work

**The accordion animation bug chain (2026-08-06) — read architecture.md's 4 invariants before touching this system again, this section is the narrative behind them.** Started from a user report that "Reclaiming the Algo"'s opening animation wasn't as smooth as "Insights & Writing"'s. Root cause, found after several rounds: `open` state used to be seeded by a mount-effect calling `toggle()` a render after the accordion's own first render, so every `defaultOpen` accordion's `open` lagged `true` by one render. That lag caused, in order: (1) a spurious close-then-reopen flash on mobile, since multiple `defaultOpen` sections' mount-triggered `toggle()` calls fought each other under the mobile-single-open rule (whichever mounted last force-closed the earlier ones); (2) after patching that by skipping the animation on defaultOpen's first transition, a *second* bug where the skip-branch didn't cancel an already-in-flight stray animation, which later fired its `settle()` and silently re-closed the content well after the page had "finished" opening; (3) after fixing that, an attempt to make the content `display` style reactive in JSX broke things worse — React writes inline styles synchronously during commit, before any effect runs, so it raced the imperative WAAPI code on every single toggle, not just the first. The actual fix (not a further patch) was removing the lag at its source: `isOpen`/`toggle` now take the caller's own `defaultOpen` prop directly as a fallback, correct from render 1, no mount-triggered toggle needed at all; `useAnimatedDisclosure` became the sole owner of `display` and switched to `useLayoutEffect`. Two more distinct bugs surfaced once the real animation was visible again — a skeleton-vs-real-content paint-order mismatch, and a `ResizeObserver` leaving a stale `0`-height reading while hidden — both are architecture.md invariants 3 and 4.

**Component-sourcing rule established mid-session:** check beui/magicui/aceternity/shadcn registries first for every new piece, before hand-porting. See architecture.md for the exact search command and everything checked so far (bouncy-accordion, carousel/swipe terms, blog-card/quiz terms, hero/profile terms) that turned out not to fit.

## Verification notes

No browser/screenshot tool was available in this environment — every change this session was verified via `npm run build` (clean TypeScript + Vite build) and the dev server responding correctly, never a real visual check. **Do an actual visual pass in a browser before considering any of the above sections "done," not just "builds clean."** The animation bug chain above was only found because the user was looking at it in a real browser and reporting back — the agent alone could not have caught any of those 4 bugs from source reading.
