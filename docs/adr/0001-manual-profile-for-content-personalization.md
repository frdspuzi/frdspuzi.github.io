# Manual PROFILE.md for content personalization, not a live sync

Content-curation prompts (the YouTube curator, the trending-repos digest) need to know who they're
curating for. There's no way to get this automatically: the Gemini API (`GEMINI_API_KEY`, what
these scripts actually call) is a stateless developer endpoint with no account login and no
awareness of the site owner — it's a completely separate product surface from Gemini Apps'
"Personal Intelligence" feature (Google account personalization, opt-in, Gmail/Photos/Search-aware),
and Google has not announced public API access to Personal Intelligence as of mid-2026. So we
maintain `PROFILE.md` at the repo root by hand instead — gitignored (personal data, never
committed), seeded from a real Google Takeout export (`Developers/My Activity.json` +
`Gemini Apps/My Activity.json`, cross-referenced) plus his own Claude Code conversation history,
rather than guesswork, and refreshed the same way if it goes stale.

**`PROFILE.md` is a dev-time reference, not a runtime dependency.** No script reads it — it doesn't
exist in the GitHub Actions runner at all (gitignored, never pushed), so a script depending on it at
runtime would silently break in production. Instead, each content-curation prompt hardcodes a
distilled, category-level paragraph directly in the committed script (matching
`fetch_youtube.js`'s existing pattern), written *from* `PROFILE.md` during development. Categories,
not identifiers: state "cares about AI/ML tooling" or "builds side projects combining Islamic ethics
and engineering," not the specific project names/URLs or employer industry `PROFILE.md` actually
names — the personalization value comes from the category, not the identifying specific.

## Considered options

- **GEPA-based prompt optimization** (reflective optimization against labeled preference data) —
  rejected for now: there's no labeled dataset for this feature on day one, and the YouTube
  curator's own GEPA experiment already showed 50 mutations overfitting and losing to a simple
  hand-written prompt even *with* 69 real labeled examples. Revisit only once real usage produces
  enough signal to optimize against.
- **Live sync with Gemini Apps' Personal Intelligence** — not possible; confirmed no public API
  bridge exists between the consumer app's personalization layer and the developer API.
