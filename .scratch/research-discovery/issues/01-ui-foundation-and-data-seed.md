# 01 — UI Foundation & Research Data Seed

**What to build:** A new Research Discovery accordion on the homepage alongside existing GitHub/Product Hunt feeds, wired into floating navigation and backed by a committed `_data/research.json` seed. Visitors see a dated snapshot placeholder card or empty state with correct accordion layout and styling.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `_data/research.json` seed file created with valid schema (lastUpdated, papers array).
- [x] TypeScript types defined for ResearchBrief (title, date, venue, topics, summary, practicalUseCase, limitation, fullTextUrl).
- [x] Research accordion section added to `Home.tsx` and registered in `FloatingNav.tsx`.
- [x] Renders snapshot placeholder without console errors on desktop and mobile.
- [x] `npm run build` and `npm run test` in `component-lab` pass.
