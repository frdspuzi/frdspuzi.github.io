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
1. Evaluate relevance to practical software engineering, cloud/data tooling, Islamic studies/finance academic research, and workplace productivity.
2. Formulate a grounded ResearchBrief JSON object:
   - id: preserve candidate id/DOI.
   - doi: preserve candidate DOI URL.
   - title: original paper title.
   - publicationDate: publication date (YYYY-MM-DD).
   - venue: journal or conference name.
   - topics: array matching assigned topics.
   - summary: 1-2 concise, accessible sentences describing what was actually demonstrated by the research.
   - practicalUseCase: 1 concrete, actionable application of the finding.
   - limitation: 1 important limitation directly grounded in the paper's limitationsExcerpt or conclusion excerpt.
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
