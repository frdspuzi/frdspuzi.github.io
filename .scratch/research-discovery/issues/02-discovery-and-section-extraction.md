# 02 — Discovery & Section Extraction Pipeline

**What to build:** An automated Node script that queries OpenAlex for recent peer-reviewed research across Tech, Islamic Studies & Finance, and Career & Productivity, fetches open-access articles, extracts bounded sections (introduction, conclusion, and explicit limitations excerpt), and writes candidate payloads to `_data/research_candidates.json`.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Script `.github/scripts/fetch_research.js` queries OpenAlex with keyless sparse requests for 3 topics.
- [x] Only accepts peer-reviewed journal/conference works published within the last 3 months.
- [x] Verifies open-access full text; skips unreadable/paywalled papers.
- [x] Extracts introduction, conclusion, and limitations sections locally without sending full PDFs.
- [x] Caps candidates to 5 per topic and writes structured payload to `_data/research_candidates.json`.
- [x] Unit tests in `.github/scripts/fetch_research.test.js` verify filtering and extraction fixtures.
