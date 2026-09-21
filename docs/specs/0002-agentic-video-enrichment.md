# Migrate YouTube video enrichment to Gemini's agentic processing mode

## Problem Statement

The YouTube curator's video-watching enrichment step is the dominant cost in the site's automated content pipeline — RM63.92 of RM66.32 spent this billing period (96%), driven by Vertex AI's Video + Audio Input Predictions, and growing with feed volume (up to 15 videos deep-enriched per day). The selection/curation step that runs alongside it is comparatively negligible (~RM2/month), so the real cost lever has always been the video-watching step specifically, not the pipeline as a whole.

## Solution

Google's Gemini API now offers "agentic" video processing: instead of sampling every frame and the full audio track, the model decides what to watch, how fast, and through which modality, driven by the actual question being asked. A live test call (YouTube URL, `processing: "agentic"`, plain `GEMINI_API_KEY`, model `gemini-3.7-flash`) confirmed this produces correctly grounded summaries and timestamps, with no itemized video/audio modality tokens in the usage response — a structurally different, cheaper consumption path than the current Vertex AI call. Migrate the video enrichment step to this new API, dropping the Vertex AI/Workload Identity Federation authentication it currently requires in favor of the `GEMINI_API_KEY` already used elsewhere in the same script.

## User Stories

1. As the site owner, I want the video-watching enrichment step to cost meaningfully less per month, so that automated content generation doesn't become financially unsustainable as the feed grows.
2. As the site owner, I want the enriched video summaries and timestamps to remain accurate and grounded in the real video content, so that visitors get a trustworthy "Key Moments" section.
3. As the site owner, I want all existing content-safety guardrails (skepticism toward misinformation, no promotion of anti-Islamic content, no hallucinated timestamps, Shorts capped under 60 seconds) preserved exactly, so that switching APIs doesn't quietly weaken content quality or safety.
4. As the site owner, I want a direct cutover with no fallback to the old Vertex AI path, so the codebase doesn't carry permanent dual-path complexity for what was only a temporary confidence problem.
5. As the site owner, I want the now-unused Vertex AI/Workload Identity Federation authentication step removed from the GitHub Actions workflow, so there's no dead credential surface left to maintain or rotate.
6. As the site owner, I want the now-unused `GCP_PROJECT_ID`/`GCP_WORKLOAD_IDENTITY_PROVIDER` references removed from the script and workflow, so the repo doesn't reference infrastructure it no longer needs.
7. As the site owner, I want the enrichment function's external interface (a video in, `{summary, timestamps, errors}` out) to stay unchanged, so nothing else in the pipeline — thumbnail sync, existing-video merge, the retry-for-empty-timestamps pass — needs to change.
8. As the site owner, I want the existing retry/backoff behavior for transient failures preserved, so a single flaky call doesn't permanently drop a video from consideration.
9. As the site owner, I want the existing "reuse a prior successful enrichment instead of re-running it" logic to keep working unchanged, so already-enriched videos aren't needlessly reprocessed and rebilled.
10. As the site owner, I want this migration scoped only to the video enrichment step, so the already-cheap selection/curation step isn't touched or destabilized by this change.
11. As the site owner, I want the `@google/genai` dependency updated to a version that actually supports the API surface this migration needs, so the code doesn't call methods that don't exist in the currently locked version.
12. As the site owner, I want the test suite updated to reflect the new auth model, so it doesn't keep asserting behavior (a Vertex-credential skip-path) that no longer exists.
13. As the site owner, I want my API key's billing project and pricing tier confirmed before relying on the projected savings, so the cost win is verified against real billing, not assumed.
14. As a site visitor, I want the "Key Moments" timestamps on curated YouTube videos to keep working exactly as before, so my experience of the feature is unaffected by this cost optimization happening underneath it.
15. As the site owner, I want this change fully isolated from the eval log, the final `youtube.json` shape, and the RSS/discovery fetching steps, so the migration's blast radius is limited to enrichment only.

## Implementation Decisions

- **Seam**: the video enrichment function is the existing, sufficient seam. Its external contract (accepts a video object, returns `{summary, timestamps, errors}`, or a bare summary-string fallback on total failure) does not change — every caller stays as-is.
- **Auth**: switch from Vertex AI client construction (project + location, Workload Identity Federation) to a plain API-key-based client — the same `GEMINI_API_KEY` already used by this script's text-curation step. The `GCP_PROJECT_ID`-gated "skip enrichment if unset" branch is removed entirely; enrichment now runs whenever `GEMINI_API_KEY` is set, which this script already requires unconditionally for its other Gemini call.
- **API surface**: move from the older single-shot content-generation call (video passed as inline file data) to the newer interaction-based call, with an `input` array: a text part (the existing prompt, guardrails included verbatim) and a video part referencing the YouTube URL directly with agentic processing requested — no file upload step, matching the current script's existing "pass the YouTube URL directly" behavior.
- **Model**: the same single hardcoded flash-tier model this function already used (confirmed via live test to support agentic processing) — this function never used the multi-model waterfall the selection step uses, and that doesn't change.
- **Response parsing**: extract the JSON block from the new response the same way the current code does from the old one (the model still wraps output in a markdown-fenced JSON block) — same regex-based extract-then-`JSON.parse` pattern, just reading from a different response field.
- **Retry behavior**: preserve the existing bounded-retry loop with per-attempt backoff around the call, and the existing defensive error-capture shape, unchanged — only the call inside the loop changes.
- **Workflow**: remove the Google Cloud authentication step from the GitHub Actions workflow and stop passing the GCP project variable to the script invocation. The underlying GitHub repository secrets are not referenced by any other workflow (confirmed) — deleting the stored secret values themselves is a manual step outside this spec's code changes.
- **Dependency**: bump `@google/genai` from its currently locked version to a version confirmed to include the API surface this migration needs.

## Testing Decisions

- Test only external behavior, not which internal API a function happens to call — matching this repo's existing convention.
- The one existing test asserting the old "GCP_PROJECT_ID unset" skip-path needs updating or removal, since that branch no longer exists after this migration.
- Prior art: the existing test file already covers this script's pure helper functions (log-entry shaping, reuse-detection, response parsing) via fixture-style inputs, with no live network calls or mocking of the Gemini API itself. Follow the same approach — no live-API test is being added for the enrichment call itself, since it wasn't live-tested before either; keep testing the surrounding pure functions.
- No new test needed for the JSON-extraction-from-response step specifically, since the extraction pattern is unchanged from the current code, only the field it reads from differs.

## Out of Scope

- The text-based selection/curation step and its own Gemini call — already cheap, not touched by this spec.
- Any change to the final `youtube.json` output shape, thumbnail syncing, or the RSS/discovery fetching steps.
- A fallback or dual-path safety net during a trial period — explicitly decided against in favor of a direct cutover.
- Migrating any of this repo's other Gemini-calling scripts — unrelated to this spec.
- Deleting the GitHub repository secrets themselves — a manual, human action outside the codebase.
- Verifying the actual dollar savings against real billing data post-migration — a manual follow-up for the site owner after this ships, not part of implementation.

## Further Notes

- Produced from a `/grilling` session using the domain-modeling lens; see that conversation for the full decision trail, including the live test call that validated agentic processing + a direct YouTube URL + a plain API key, and an earlier, abandoned exploration of a transcript-based approach that hit real dead ends (an old caption-fetching endpoint returning empty responses).
- A real security note surfaced during that session: the site owner's IDE selection pasted the full raw `GEMINI_API_KEY` value into the conversation transcript. Rotating that key is recommended, independent of this spec.
- No issue tracker is configured for this repo (same situation as spec 0001) — this spec is written to a file, not published anywhere, and carries no `ready-for-agent` label.
