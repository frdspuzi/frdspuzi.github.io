# AI Learning Trivia routine prompt

Checked-in copy of the prompt for the Claude cloud routine "AI Learning Trivia (Claude, replaces Gemini)" (`trig_015ZtrruwyZfqhTrQMeGrd7U`, daily 22:30 UTC). The live prompt lives in the routine itself; keep the two in sync. Book sources were added 2026-11-19 (see `docs/adr/0002-tldrs-stay-private.md` and the Trivia question term in `CONTEXT.md`).

---

You're replacing a GitHub Actions script (.github/scripts/generate_learning.js) that calls the Gemini API to generate daily learning-trivia content for a personal portfolio site (frdspuzi.github.io). Your job: read the real source data from the repo, do the extraction and reasoning, then write, commit and push the result. The repo is already cloned at your working directory.

0. Sync FIRST, before reading or writing anything: run `git fetch origin && git checkout -B master origin/master`. The clone can start on a detached HEAD or a stale local master branch; this puts you on the latest master with a clean tree.

1. Read the two kinds of source at the REPO ROOT. Do NOT fetch any URL: this environment's network policy blocks outside sites, and the files already have the data.
   a. **Articles**: `_data/medium.json`, a JSON array of the site owner's Medium articles in rss2json item shape (title, link, content HTML, categories), refreshed daily by medium.yml.
   b. **Books**: every `*.md` file directly inside `_books/` (top level only). NEVER read anything under `_books/private/`, which holds private AI summaries of book content that must never be published or quizzed. Each book file has `key: value` front matter between `---` lines (use `title`), then the owner's overall take, then `## ` chapter headings and `### ` insight headings (each insight heading is a page range like "pp. 36–37", and the text under it is the insight). The book's slug is its filename without `.md`.

2. Prepare the sources:
   - Article: strip HTML tags from `content` and collapse whitespace; skip it if the cleaned text is under 100 characters; truncate to the first 15000 characters.
   - Book: use ONLY its insights (the text under each `### ` heading). Drop any insight that is empty or contains the word `TODO`, which marks an unwritten draft. Skip the whole book if no insights remain. The book's text is its remaining insights joined together, each prefixed with its page range.
   - Each usable article and each usable book is ONE source. Call the number of sources N.

3. Generate exactly 15 questions in total, spread as evenly as possible across ALL N sources: each source gets floor(15 / N) questions, and the remaining (15 mod N) questions go one each to the longest sources (by cleaned-text length). Compute this split with a tiny Node one-liner, not by hand. For each question:
   a. Pick ONE angle from this list, never reusing an angle within the same source: ["a surprising, lesser-known detail, or specific fact mentioned", "the core underlying philosophy, main argument, or thesis", "the historical context, background story, or primary motivation behind the topic", "a specific quote, lesson, or moral takeaway", "a common misconception, pitfall, or challenge described", "a specific term, definition, or core concept introduced", "the conclusion or the final actionable takeaway of the piece"].
   b. Extract ONE "nugget of knowledge" per your chosen angle: a valuable, standalone fact, concept or insight (1-2 sentences), grounded ONLY in that source's actual text. Do NOT add outside knowledge.
      - For a book this rule is strict. The question must be answerable from the owner's insight alone. Even if you know the book, never use anything from the book itself that the insight doesn't state, and never restate the book's content beyond what the insight says. You are testing the owner's takeaway, not the book.
   c. Write a multiple-choice trivia question testing that exact learning. CRITICAL: phrase it as general standalone trivia, never "According to the text", "Based on the article", "As mentioned", etc. Provide the correct answer, plus 3 plausible but incorrect answers.
   d. Every question must test a different fact: no two questions may test the same idea or share the same correct answer. If a source can't support its share of distinct questions, move the leftover questions to the next-longest source rather than repeating yourself. Still aim for 15 in total.

4. For each question you'll have: question, correctAnswer (string), incorrectAnswers (array of 3 strings), learning (the extracted insight), articleTitle, articleUrl, category.
   - Article: articleTitle = the article's title, articleUrl = its `link`, category = its first `categories` entry, or "uncategorized" if none.
   - Book: articleTitle = the book's `title`, articleUrl = `/books/<slug>/`, category = exactly `Books`.

5. For each one, shuffle [correctAnswer, ...incorrectAnswers] into a 4-item `options` array using a real Fisher-Yates shuffle (write and run a tiny Node script; don't shuffle by hand) and compute `correctIndex` as the correct answer's index in the shuffled array. A wrong correctIndex breaks the quiz.

6. Write `_data/learning.json` at the REPO ROOT (not inside component-lab/), overwriting entirely, with exactly this shape:
```json
{
  "learnings": [
    { "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "learning": "...", "articleTitle": "...", "articleUrl": "...", "category": "..." }
  ],
  "fetchedAt": "<current UTC time in ISO-8601 format>"
}
```
If you end up with zero questions (no usable sources), do NOT write the file - stop and report why instead.

7. Stage only `_data/learning.json` and commit with message exactly `chore: Update AI Learning`. Do NOT add `[skip ci]` - this commit should trigger the normal deploy (deploy-pages.yml deploys on any push to master).

8. `git push origin master`. If it's rejected because master moved: `git fetch origin && git rebase origin/master`. If `_data/learning.json` conflicts, keep YOUR version - the file is fully regenerated each run, so the other side is simply older content: `git checkout --theirs _data/learning.json && git add _data/learning.json && GIT_EDITOR=true git rebase --continue` (during a rebase, "theirs" is your own commit). Then push again. If it still fails after one retry, stop and report the error clearly - do not force-push.

9. Always publish today's newly generated content. An existing learning.json that was updated earlier today is NOT a reason to skip or discard your commit.

Context: this routine replaces per-call-billed Gemini API usage with Claude-generated content. Don't touch any other files, don't modify the GitHub Actions workflows, and don't touch other Gemini-calling scripts.
