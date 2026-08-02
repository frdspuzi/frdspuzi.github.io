# frdspuzi.github.io Architectural Context

**Tech Stack:**
- **Site generator:** Jekyll, hosted on GitHub Pages (`master` branch auto-publishes).
- **Layout base:** GitHub's Primer CSS (`@import url('https://unpkg.com/primer/build/build.css');` in `assets/styles.scss`), extended with custom SCSS. `_sass/_highlight-syntax.scss` is the only partial; everything else lives directly in `assets/styles.scss`.
- **Frontend interactivity:** Vanilla JS only, inlined in `<script>` tags inside the relevant `_includes/*.html` file (no bundler, no framework, no shared JS file). Each interactive section owns its own script block.
- **Content automation:** Node.js scripts in `.github/scripts/` call the Gemini API (`@google/genai`) and the Unsplash/YouTube Data APIs, run on a schedule via GitHub Actions, and commit their output straight into `_data/*.json`. The Jekyll templates then read those JSON files at build time — there is no runtime API calls from the browser for AI content.
- **Cache-busted asset URLs:** every CSS/JS asset linked in `header.html`/`footer.html` (`styles.css`, and the 4 shared scripts loaded from `footer.html`) carries `?v={{ site.asset_version }}` — a plain integer defined in `_config.yml`, so the URL only changes when that number is bumped, forcing a visitor's browser to fetch a fresh copy instead of reusing a stale cache. Added 2026-08-02 after a real phone showed completely unstyled markup for a just-shipped feature while desktop DevTools' phone emulation (which reuses the desktop browser's already-current cache) looked correct — confirmed via `curl` that the live site itself was already serving the right HTML/CSS, so the only variable was the one browser's stale cached asset. **Any new asset added to `header.html`/`footer.html` needs the same `?v={{ site.asset_version }}` suffix from the start.**
  - **Originally tied to `site.time` (Jekyll's build timestamp), switched to a manual version number the same day.** `site.time` changes on *every* build, and this site rebuilds many times a day from bot commits (`_data/*.json` updates) that never touch `styles.css`/the JS files at all — yet every one of those unrelated deploys still forced every visitor's *next* page load to fully re-fetch those assets. That's not just extra bandwidth: `styles.css`'s `<link>` sits in `<head>` and **blocks execution of any script after it in the document** (even inline, non-deferred ones) until it finishes loading — a real, measurable delay when uncached, not just a theoretical one. This surfaced as a visible bug: `youtube_feed.html`'s inline script (which populates the video card's text from `_data/youtube.json`) was delayed just long enough after a deploy for its static HTML placeholders ("Video Title", "Channel Name", "AI Summary goes here.") to be visibly on-screen for a moment, self-resolving on the next load once the browser's cache was warm again. Root-caused and fixed same-day by moving cache-busting off the build timestamp entirely: `_config.yml`'s `asset_version` (currently `1`) is bumped **by hand only when `styles.scss` or one of the 4 shared JS files actually changes** — unrelated deploys no longer touch it, so the cache is only busted when there's genuinely something new to fetch. Requires remembering to bump it; the comment directly above `asset_version` in `_config.yml` is the guard against forgetting.
  - **A true content-hash approach (auto-computed, no manual bump needed) was considered and rejected for now:** this site builds on GitHub Pages' native Jekyll pipeline (`github-pages` gem, no custom GitHub Actions build/deploy workflow), which only permits a fixed plugin allowlist — there's no way to hash file contents at build time without switching to a GitHub Actions-based build (`actions/jekyll-build-pages` + `actions/deploy-pages`), which is a bigger infrastructure change than this warranted. Revisit if the manual-bump discipline turns out to be unreliable in practice.

**Page Composition (`_layouts/home.html`):**
Two mutually exclusive layouts controlled by `site.layout` in `_config.yml` (`stacked` vs sidebar), both rendering the same includes in the same order:
1. `masthead.html` (bio/avatar — the "About" section)
2. `gratitude.html`
3. `youtube_feed.html` ("Reclaiming the Algo")
4. `thoughts.html` ("Insights & Writing" — Medium feed + `learning_board.html` trivia side-by-side)
5. `photography.html`
6. `projects.html` / `interests.html` are present but wrapped in `{% comment %}` — currently disabled, not deleted.
7. `floating_toc.html` renders last but is `position: fixed`, so it overlays regardless of DOM order.

`floating_toc.html`'s anchor list is the single source of truth for actual page order — if you reorder sections in `home.html`, update the TOC's `data-target` list and anchor IDs to match, or the nav will silently point at the wrong section.

**Data Flow / Automation Architecture:**
```
.github/workflows/*.yml (cron)
        │
        ▼
.github/scripts/*.js (Node, Gemini/Unsplash/YouTube APIs)
        │
        ▼
_data/*.json  (committed back to the repo by the workflow itself)
        │
        ▼
_includes/*.html  (Liquid reads _data.* at Jekyll build time, renders static HTML)
```
Each dynamic section has its own workflow → script → JSON file → include, all four wired 1:1:

| Section | Workflow | Script | Data file(s) |
|---|---|---|---|
| Gratitude | `ai-gratitude.yml` | `generate_gratitude.js` | `_data/gratitude.json` |
| AI Trivia (`learning_board.html`) | `ai-learning.yml` | `generate_learning.js` | `_data/learning.json` |
| YouTube Feed | `ai-youtube.yml` | `fetch_youtube.js` | `_data/youtube.json`, `_data/youtube_eval_log.json` |
| Unsplash Gallery | `unsplash.yml` (standalone, own schedule) | `fetch_unsplash.js` | `_data/unsplash_all.json` (entire profile, paginated), `_data/unsplash_favourites.json`, `_data/unsplash_meta.json` (change-detection cache — see below) |

`ai-daily-content.yml` is the orchestrator: it runs daily (`30 0 * * *` UTC) and calls the youtube/gratitude/learning child workflows via `uses:`/`secrets: inherit`, but each child workflow also has its own `workflow_dispatch` so it can be triggered individually. `unsplash.yml` is NOT part of the orchestrator — it runs standalone, twice a day (`0 0,12 * * *`).

**Change-detection before fetching (Unsplash only, 2026-07-27, extended 2026-08-02):** `fetch_unsplash.js` checks 3 cheap signals before doing the expensive paginated fetch, comparing all of them against `_data/unsplash_meta.json` from the last run — if every one is unchanged, it skips the fetch entirely and exits. This exists because the script runs on a *fixed schedule* regardless of whether the profile actually changed, and fetching the *entire* photo history (see below) on every run, twice a day, whether or not anything's different, would burn meaningfully more of Unsplash's 50 req/hr free-tier budget than the old fixed-size (12/5/12 photo) fetches did.
- `total_photos` on the user profile and the Favourites collection (2 single-object API calls) — catches pure additions or deletions.
- **The single most recent photo's `id`** (a 1-item `order_by=latest` fetch — still cheap, not the full pagination) — added after the user pointed out a real gap: `total_photos` alone misses a delete-one-then-upload-one edit, since the net count is identical before and after even though the actual photo set changed. A freshly reuploaded photo becomes a *different* "latest" photo regardless of whether the count moved, so checking its `id` catches that case too.
- **Known remaining gap, not addressed:** a metadata-only edit to an older, non-latest photo (no add/remove, no new upload) changes neither signal. Catching that would require fetching enough to compare every photo's own `updated_at`, which defeats the point of a cheap pre-check — left as a real but low-priority gap, not silently assumed-covered.
- If another data source is ever changed to fetch "everything" instead of a bounded slice, consider the same layered pattern: a cheap count/identity check first (more than one signal if a single count can miss same-size replacements), a persisted "last known state" file, skip the expensive call only when *all* signals agree nothing changed.

**Design System Rules:**
- The single source of truth for colors, typography, spacing, radius/shadow scale, and component patterns is [DESIGN.md](../DESIGN.md). Always check it before hardcoding a new color or picking a new radius/shadow value — reuse what's there instead of introducing a slightly different one.
- **Dark mode is a real runtime toggle**, not a build-time-only setting — a `data-theme="light"|"dark"` attribute on `<html>` (set from `_config.yml`'s `site.style` at build time via Liquid in `header.html`, overridable at runtime by the Rectangle toggle button in `floating_toc.html`, persisted to `localStorage`). Colors are a CSS custom-property layer (`--fg`, `--surface`, `--border`, `--accent`, etc.) defined as **two** blocks in `assets/styles.scss` — `:root { }` (light defaults) and `[data-theme="dark"] { }` (overrides) — both shipped to the browser on every load, switched instantly by the attribute, no rebuild needed. There are **no** `{% if site.style == 'dark' %}` branches left anywhere in the codebase (not for colors, not for Primer class toggles) — every one was converted to `var(--token-name)` or one of the `.theme-fg`/`.theme-fg-muted`/`.theme-surface`/`.theme-surface-page`/`.theme-border` utility classes, specifically so the whole page actually responds when the toggle is clicked. If you add new themed CSS, add the value to **both** blocks (or reuse an existing token) — never reintroduce a Liquid `{% if site.style == 'dark' %}` branch for color; that mechanism is gone.
- Spacing is Primer utility classes (`p-4`, `mb-5`, `d-flex`, etc.) plus ad-hoc inline `style="..."` for anything Primer doesn't cover.
- Collapsible sections use native `<details open>` + `<summary>` with a bouncy open/close animation — see the Interaction Rules entry below, this is no longer zero-JS.

**Interaction Rules:**
- Each `_includes/*.html` file is self-contained: its own `<script>` and `<style>` blocks at the bottom of the file. Do not centralize JS into a shared `main.js` — the existing convention is one file per feature.
  - **Four deliberate exceptions**, all loaded site-wide via `_includes/footer.html`: `assets/js/accordion.js` drives the bounce open/close animation for every `details.animated-details` on the page (a cross-cutting UI primitive used by 4 sections, not a single feature); `assets/js/quote-typing.js` types out every `<blockquote>` on the page on first scroll-into-view, for the same reason — a generic rule, not a one-off; `assets/js/aurora-reveal.js` runs the on-load reveal sweep for every `.aurora-text` element (currently 2 usages in `masthead.html`); `assets/js/accordion-grouping.js` joins adjacent closed `.js-accordion-group` sections into a flush block (currently one group of 3, the homepage's main sections) — same justification, a generic rule operating on whatever elements carry that class, not hardcoded to specific sections. See [DESIGN.md](../DESIGN.md)'s Motion/Component Patterns sections for the easing/timing values and the markup assumptions each script makes. Don't flag any of these as a convention violation; don't add a fifth shared JS file without the same cross-cutting justification.
- Scope `document.getElementById`/`querySelector` calls to IDs/classes that are unique to that include; several sections already coordinate via small global hooks on purpose (e.g. `window.filterTrivia`, `window.currentTypingTimeout` in gratitude's typewriter circuit breaker) — check `thoughts.html` and `gratitude.html` before adding another one so hooks don't collide.
- `_data/*.json` files are written by GitHub Actions, not by hand — editing them locally is fine for testing but will be overwritten on the next scheduled run.
