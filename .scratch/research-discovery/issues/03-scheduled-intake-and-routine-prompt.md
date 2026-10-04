# 03 — Scheduled Intake Workflow & Claude Routine Prompt

**What to build:** A daily GitHub Actions intake workflow that executes the discovery script and commits candidate files with `[skip ci]`, paired with a checked-in Claude Routine prompt template that reads the candidates, generates grounded research briefs, and commits `_data/research.json` (triggering automatic site deployment).

**Blocked by:** 02 — Discovery & Section Extraction Pipeline

**Status:** done

- [x] `.github/workflows/research-intake.yml` scheduled daily, runs `fetch_research.js`, and commits `_data/research_candidates.json` with `[skip ci]`.
- [x] Checked-in routine prompt template (`.github/prompts/research_routine.md`) defines prompt instructions for Claude web routine.
- [x] Prompt instructs Claude to read `_data/research_candidates.json`, rank papers, generate concise summary + use case + limitation grounded in excerpts, and write `_data/research.json`.
- [x] Routine commit omits `[skip ci]` so GitHub Pages deployment is triggered on master.
