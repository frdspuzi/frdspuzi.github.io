# Claude Routine Prompt — Research Discovery Briefs

Copy and paste this prompt when configuring the scheduled cloud routine in the Claude console (recommended schedule: 22:45 UTC daily, 25 minutes after `research-intake.yml`).

```text
You are maintaining the Research Discovery feed for frdspuzi.github.io.

## Step 1: Git Sync
Sync with master first to ensure a clean state:
git fetch origin
git checkout -B master origin/master

## Step 2: Read Candidates and Existing Data
Read `_data/research_candidates.json` and existing `_data/research.json`.
If `_data/research_candidates.json` has 0 candidates, do not overwrite `_data/research.json`; retain the existing snapshot and exit cleanly.
If every candidate is discarded in Step 3, also keep the existing snapshot and exit cleanly.

## Step 3: Curate and Generate Briefs
For each candidate paper across the three topics (Tech, Islamic Studies & Finance, Career & Productivity):
1. Evaluate relevance to practical software engineering, cloud/data tooling, Islamic studies/finance research, and workplace productivity.
   Discard a candidate when it is off-topic for its bucket (for example clinical medicine or pharmacology, or game-industry analytics filed under productivity).
   Discard a candidate when it is a survey or position paper with no measured finding to state.
2. Use only facts and numbers present in the candidate's excerpts. Never invent a statistic. If the excerpt gives no number, state the finding without one.
   If `limitationsExcerpt` is empty, base `limitation` on the stated scope: sample, region, model family, method, or design (for example "shows links, not cause").
3. Formulate a grounded ResearchBrief JSON object. Follow strict Simplified Technical English (ASD-STE100) rules — assume a non-expert layman reader:
   - Findings-first, zero preview CTAs: Assume the reader will NEVER read the full paper. The card must be a self-contained knowledge brief. Never write teaser abstracts (e.g. "This study examines...", "Surveyed methods to...", "Tested whether..."). Directly state what the research actually found, measured, or proved with concrete numbers and mechanisms.
   - Short sentences (under 20 words each).
   - One idea per sentence, active voice, plain everyday words.
   - Zero dense academic jargon (e.g. say "smart steering" instead of "sliding mode reaching law", "server health chart" instead of "multivariate time series").
   - If a technical term is unavoidable, explain it in the very next sentence rather than assuming it is understood.
   - Never include emojis anywhere in titles, problems, fixes, use cases, or limitations. Do not output a `summary` field.
   - id: preserve candidate id/DOI.
   - doi: preserve candidate DOI URL.
   - title: original paper title.
   - publicationDate: publication date (YYYY-MM-DD).
   - venue: journal or conference name.
   - leadAuthor: lead author name if present in candidate (e.g. "J. Doe et al.").
   - institution: primary institution if present in candidate (or omit if empty).
   - topics: array matching assigned topics.
   - problem: exactly 1 sentence, from the candidate's introduction (the gap or objective). Problem alone must answer: who or what was stuck, on what, and what went wrong or was missing. Example: "Apps that ask an LLM to pick each action wait too long, so requests miss their time limit." Do not repeat the title or use the paper's jargon. Add no numbers unless the paper measured the problem itself.
   - fix: exactly 1 sentence, from the candidate's conclusion: what the authors built or found, plus the measured result with its numbers. For an empirical paper with no solution, state the answer to the paper's objective. Never write "This paper...".
   - practicalUseCase (shown to the reader as "Why it matters"): exactly 1 sentence. Say what changes if the finding is true, then what to do about it.
   - limitation (shown as "Caveat"): exactly 1 honest, plain-language sentence grounded in the paper's limitations/conclusion explaining what is still missing, broken, or untested.
   - fullTextUrl: direct link to the paper.
4. Select up to 5 highest-quality papers per topic. Multi-topic papers are permitted.
   Fewer than 5 is fine; never pad a topic with weak papers.
5. Check every string before writing: each sentence has 20 words or fewer, and no emoji appears anywhere.

## Step 4: Write Output
Write the final snapshot to `_data/research.json`:
{
  "lastUpdated": "<YYYY-MM-DD of today>",
  "papers": [ ... ]
}

## Step 5: Commit and Deploy
Commit without [skip ci] so the site automatically deploys via deploy-pages.yml:
git config --global user.name 'claude-routine[bot]'
git config --global user.email 'claude-routine[bot]@users.noreply.github.com'
git add _data/research.json
git diff --cached --quiet && echo "No changes to commit" && exit 0
git commit -m "feat: Update Research Discovery briefs"
git pull --rebase -X theirs origin master
git push origin master
```
