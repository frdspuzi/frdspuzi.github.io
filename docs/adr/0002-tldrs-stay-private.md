# Book TLDRs stay private; only the owner's Insights are published

The Bookshelf shows the owner's Reading notes for each book. While reading, the owner collects AI-generated TLDRs (one per passage, from a Gemini browser extension) to help write their Insights. The TLDRs closely paraphrase the book's own narrative, case studies and arguments, and the owner has no right to republish a book's content. So TLDRs are kept in a gitignored folder next to the Insights and are never committed. This repo is the public source of a GitHub Pages site, so anything committed is published, even if no page renders it, and stays in git history permanently. Only Insights, the owner's own takeaways in their own words, are committed and shown.

## Consequences

- Insights may quote at most one attributed sentence from the book. Anything longer brings back the problem this decision avoids.
- The site's code never reads TLDRs. They exist only on the owner's machine, the same way `PROFILE.md` does (see ADR 0001).
- An AI assistant may read a TLDR in conversation, only to ask the owner questions about that passage. The Insight is written from the owner's answers. Nothing is copied or paraphrased from the TLDR into it.
- Don't "fix" the gitignore entry to bring TLDRs into the build, even for a hidden or collapsed view. Hiding them in the UI doesn't stop them being published.
