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

## Step 3: Curate and Generate Briefs
For each candidate paper across the three topics (Tech, Islamic Studies & Finance, Career & Productivity):
1. Evaluate relevance to practical software engineering, cloud/data tooling, Islamic studies/finance research, and workplace productivity.
2. Formulate a grounded ResearchBrief JSON object. Follow strict Simplified Technical English (ASD-STE100) rules — assume a non-expert layman reader:
   - Short sentences (under 20 words each).
   - One idea per sentence, active voice, plain everyday words.
   - Zero dense academic jargon (e.g. say "smart steering" instead of "sliding mode reaching law", "server health chart" instead of "multivariate time series").
   - If a technical term is unavoidable, explain it in the very next sentence rather than assuming it is understood.
   - Never include emojis anywhere in titles, summaries, use cases, or limitations.
   - id: preserve candidate id/DOI.
   - doi: preserve candidate DOI URL.
   - title: original paper title.
   - publicationDate: publication date (YYYY-MM-DD).
   - venue: journal or conference name.
   - leadAuthor: lead author name if present in candidate (e.g. "J. Doe et al.").
   - institution: primary institution if present in candidate (or omit if empty).
   - topics: array matching assigned topics.
   - summary: 1-2 short, plain-language sentences in STE100 style describing what the researchers built or proved.
   - practicalUseCase: 1 concrete, plain-language sentence explaining how someone can use this in the real world.
   - limitation: 1 honest, plain-language sentence grounded in the paper's limitations/conclusion explaining what is still missing, broken, or untested.
   - fullTextUrl: direct link to the paper.
3. Select up to 5 highest-quality papers per topic. Multi-topic papers are permitted.

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
git commit -m "feat: Update Research Discovery briefs"
git pull --rebase -X theirs origin master
git push origin master
```
