# Research discovery

Status: approved; scheduled Claude routine architecture chosen (zero-token file-handoff matching Learning Trivia).

## Objective

Help the site owner stay up to date with research findings and discoveries through another website section. Each paper has a short summary and a practical use case, following the GitHub/Product Hunt briefs.

## Settled decisions

- Interest coverage follows the existing personal profile within three owner-selected topics: **Tech**, **Islamic Studies & Finance**, and **Career & Productivity**. Tech includes applied AI/coding tools, cloud/data engineering, and model evaluation/prompt optimization. Football is excluded from this feature without changing the private profile's broader interests.
- The owner's guiding objective shapes selection across those interests. Islamic Studies covers academic research about Islam and Muslim life; religious guidance requires a different sourcing standard and is outside this section's scope.
- Relevant theoretical breakthroughs may appear when explained accessibly. The profile's earlier exclusion of math-heavy papers does not automatically exclude them from this feature.
- Papers must have undergone peer review. Preprints without confirmed peer review are excluded. The owner prefers scrutiny over the earliest possible access to findings.
- The entry requirement is verified acceptance by a selected peer-reviewed journal or conference. Independent replication is additional evidence, not mandatory. Each brief must be source-grounded, describe what was actually demonstrated, and include an important limitation; mention available code or independent validation when documented.
- The section supports filtering papers by the three topic tags above, following the existing YouTube and Medium pill tabs: All by default, one selected topic at a time, papers may belong to multiple topics, and only topics represented in the current papers are shown.
- Require freely accessible full text. Skip candidates whose full text cannot be accessed; abstracts alone do not meet the brief-grounding requirement.
- Full-text access is for source verification and local section extraction. The owner wants AI input limited to the introduction and conclusion rather than the entire paper. Including a dedicated limitations excerpt is proposed but not yet agreed. This supersedes the earlier native whole-PDF model-input proposal.
- Prioritize papers published within the last three months. Older work may appear occasionally when there is a clear reason it matters now; its publication date must be visible.
- Check for new eligible papers daily, updating the feed only when worthwhile findings qualify. There is no daily quota; retain previous picks when there is nothing useful to add.
- Rank eligible papers by relevance to the owner's interests, significance of the finding, and potential benefit through useful understanding or practical application. Popularity and citation counts are supporting signals. Explain benefit concretely in the use case, within what the paper demonstrates.
- Use a replacement snapshot rather than an accumulating website archive, following GitHub Trending. Keep up to five selected papers per topic. Show the first five papers for the active filter, with Load more revealing the remaining selected papers. Keep the prior shortlist when no worthwhile new selection can be published.

## Proposed delivery

- Add a separate Research Discovery accordion adjacent to the existing GitHub/Product Hunt section, with a corresponding floating-navigation entry. Follow existing desktop/mobile accordion behavior and styling.
- Reuse the existing single-select pill tabs, with All initially selected. Use fixed internal keys and the agreed three display labels. Filter changes preserve curated order; a multi-topic paper appears once in All and in each matching topic.
- Each compact card follows GitHub Trending and Product Hunt design patterns: inline rank `#{rank}` inside the title heading, meta row with Lead Author and Institution (`leadAuthor • institution`), topic tags, plain-language hook summary, italicized practical application (`Why it matters`), and one concise caveat. No emojis are used anywhere on cards. The "Last updated" date is omitted from the UI to avoid clutter. Link to the paper's accessible full text; include available code and documented independent validation as additional information.
- Skip an individual paper if acceptance, accessible matching full text, or a grounded valid brief cannot be established. Publish a new snapshot only from qualifying papers; failed ingestion or an entirely unusable selection keeps the previous snapshot. Explicit evidence of withdrawal/retraction disqualifies a paper.
- Extract permitted sections locally and provide only bounded section text plus metadata to the generator. Cache successful briefs and bound new-paper processing. When publisher HTML scrapers return 403 blocks, reconstruct the abstract from OpenAlex's verified inverted index as a fallback.
- Settled cost-sensitive architecture: a daily GitHub Actions workflow handles discovery, verification, and local section extraction (intro + conclusion, and limitations excerpt when present). It writes the bounded candidate payload to `_data/research_candidates.json` and commits with `[skip ci]`. A scheduled Claude routine (configured in web console, matching the Learning Trivia routine pattern) wakes up ~30 min later, reads `_data/research_candidates.json`, generates grounded briefs, writes `_data/research.json`, and commits without `[skip ci]`, activating the existing push deployment. This requires zero webhook tokens or API keys.
- Visitors read only the built research snapshot and make no feed, PDF, or AI requests.

## Proposed implementation and verification

Add the discovery/section-extraction script and fixtures/tests, a checked-in routine prompt, an empty `_data/research.json` seed, the daily intake workflow, research types, section/list components, and local styling. Integrate through `Home.tsx` and both the navigation section registry and its accordion-default mapping in `FloatingNav.tsx`. Do not refactor shared accordion behavior or unrelated feed scripts. Search component registries before new interactive UI, per architecture guidance.

Use readable article HTML or a local PDF text extractor. Confirm title/DOI identity and extract the introduction and conclusion before any AI call. Missing, unreadable, or ambiguous sections fail extraction rather than sending the whole paper. Validate the extraction dependency and routine trigger payload limits during implementation. No model calls or paid processing have been performed during this design interview.

Meaningful tests cover reviewed-paper eligibility, full-text matching/access, required grounded brief fields, fixed topic tags and multi-topic deduplication/caps, snapshot preservation, and mixed-topic filtering/Load more. Run existing script and frontend checks and build, then verify real desktop/mobile behavior, navigation, filters, and disclosure sizing. No speculative additional E2E suite is required by current policy.

## Proposed sources and verified discovery results

Use Hugging Face Daily Papers API for Tech (active trending AI models, papers with code, unauthenticated keyless REST API), and OpenAlex for Islamic Studies & Finance and Career & Productivity with abstract reconstruction fallback. Note: OpenReview API (`api2.openreview.net`) mandates Cloudflare bot challenges (HTTP 403), so Hugging Face Daily Papers replaces it for resilient keyless CI intake.

| Topic | Initial sources | Verified discovery details |
| --- | --- | --- |
| Tech | Hugging Face Daily Papers API (`https://huggingface.co/api/daily_papers`), supplemented by OpenAlex/PVLDB | Hugging Face API provides curated daily papers with direct arXiv/abstract links, code repositories, and upvotes without rate-limits or Cloudflare blocking in GitHub Actions. |
| Islamic Studies & Finance | JIMF (`S2737324406`), IJIFSD (`S5407045253`); Indo-Islamika (`S4210226974`) for possible relevant older work | JIMF returned 8 and IJIFSD 9 recent article/review candidates. Canonical publisher PDF downloads for one sample from each succeeded. IJIEF and Indo-Islamika returned no recent candidates in the initial three-month search. |
| Career & Productivity | PLOS ONE (`S202381698`), Frontiers in Psychology (`S9692511`), with workplace/productivity relevance filtering and attention to Organizational Psychology | Combined workplace-productivity search returned 181 candidates; a recent Frontiers Organizational Psychology paper's publisher PDF download succeeded. |

These are discovery counts, not fully screened eligible-paper counts. Current research still needs review/publication evidence, scope screening, full-text identity verification, and brief validation. Coverage and source metadata can be incomplete, so keep the source list configurable.

An actual OpenAlex metadata error returned unrelated referenced PDFs for two IJIFSD articles. Resolve canonical publisher pages and their paper links instead of trusting `best_oa_location.pdf_url` blindly, then confirm title/DOI/content identity. Likewise, source-level OA flags were false for some openly publishing journals; check access at the individual paper level.

Publication type or an open-access metadata flag alone is insufficient: verify the research article's reviewed publication/acceptance and retrieve matching full text before generating a brief. Exclude unreviewed submissions and non-research material. Recheck current picks for documented withdrawals/retractions as well as new candidates. Keep publication, access, and brief-source provenance.

## Existing constraints

- The site is a static Vite/React application deployed through GitHub Pages.
- Existing feeds use scheduled ingestion and committed data snapshots.
- The personal profile is a private development reference. Public prompts and generated briefs must use distilled interest categories rather than identifying details, following ADR 0001.

## Implementation validations

- Verify configured article/track types and authoritative publication/acceptance evidence for each source.
- Test document identity, local section extraction, structured-output validation, and ranking/tagging on real samples.
- Start with tested keyless basic OpenAlex queries; optionally support a free API key for more predictable quota. Keep requests sparse and handle rate limits.
- Validate the routine payload size/access, subscription usage behavior, commit/deploy path, and extraction dependency before scheduling. No new paid provider subscription is proposed.

## Cost and grounding decisions settled

- Sources provide free paper access. Discovery queries use keyless OpenAlex allowances. Actions runner is standard free GitHub-hosted runner.
- Generator settled on scheduled Claude routine: Gemini key is depleted (HTTP 402 verified), while user already maintains active Claude subscription with scheduled routines. Candidate file handoff avoids all webhook/token infrastructure.
- Candidate payload bounds: only introduction, conclusion, and explicit limitations excerpt (when present) are written to `_data/research_candidates.json`. Bounded to ~2.5k–3k tokens per paper, maximum 5 candidates per topic per run.
- Routine reads `_data/research_candidates.json`, generates briefs, and writes `_data/research.json`.

## Source policy references

- [OpenAlex work types](https://help.openalex.org/data/work-types/) and [open-access locations](https://help.openalex.org/data/works/open-access/).
- [OpenReview accepted-submission retrieval](https://docs.openreview.net/how-to-guides/data-retrieval-and-modification/how-to-get-all-notes-for-submissions-reviews-rebuttals-etc).
- [JMLR](https://www.jmlr.org/), [PVLDB](https://www.vldb.org/pvldb/), and [ICLR review policy](https://iclr.cc/Conferences/2026/CallForPapers).
- [IJIEF](https://journal.umy.ac.id/index.php/ijief/about) and [Indo-Islamika](https://journal.uinjkt.ac.id/index.php/indo-islamika/index).
- [JIMF review and open access](https://jimf-bi.org/JIMF/about), [IJIFSD peer review](https://journal.inceif.edu.my/index.php/ijifsd/peer-review-process), and [IJIFSD open access](https://journal.inceif.edu.my/index.php/ijifsd/open-access-policy).
- [PLOS ONE review](https://journals.plos.org/plosone/s/reviewer-guidelines) and [Frontiers Organizational Psychology](https://www.frontiersin.org/journals/psychology/sections/organizational-psychology/about).
- [Gemini document processing](https://ai.google.dev/gemini-api/docs/document-processing), [OpenAlex authentication](https://help.openalex.org/api/authentication/), and [retraction metadata](https://help.openalex.org/data/works/attributes/).
- [OpenAlex free usage costs](https://help.openalex.org/access/example-costs/), [Claude routine triggers and usage](https://code.claude.com/docs/en/routines), and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Decisions confirmed and approved by site owner. Ready for implementation.
