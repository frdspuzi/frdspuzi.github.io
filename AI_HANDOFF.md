# AI Assistant Handoff & Project Context

> [!IMPORTANT]
> **CRITICAL AI INSTRUCTION:** 
> If you are an AI assistant working on this repository, you **MUST** update this `AI_HANDOFF.md` file every single time you make a change to the codebase. Do not end a session without documenting the new features, structural changes, or logic updates in this file to keep it as the single source of truth.

*If you are an AI assistant reading this, welcome! This document contains the cumulative context, architectural decisions, and custom features built into Firdaus's Jekyll portfolio website.*

## 🏗️ Project Overview
This is a personal portfolio and blog built using **Jekyll** (hosted on GitHub Pages). The core theme is minimalist and clean (heavily utilizing GitHub's Primer CSS), but it has been highly customized to include automated, dynamic, and gamified elements that fetch fresh data via GitHub Actions.

---

## 🚀 Major Custom Features

### 1. The Interactive AI Trivia Game (`_includes/learning_board.html`)
We transformed a static "AI Insight" quote block into an interactive, gamified trivia experience that sits right underneath the "My Writing" heading. 
- **How it works:** A Node.js script (`.github/scripts/generate_learning.js`) fetches Firdaus's latest Medium articles via RSS. It then uses the **Gemini 3.5 Flash API** (`v1beta` endpoint) to extract a core concept and generate a 4-option multiple-choice trivia question in strict JSON format. 
- **The UI:** The front-end reads this JSON and builds an interactive quiz. It features:
  - Green/Red validation states with CSS shake animations for wrong answers.
  - An endless loop "Skip Question" / "Next Question" button. A **shuffled queue** cycles through all questions in random order before any repeats, so the same question is never shown twice in a row.
  - A "Not sure? Read the article" hint link that opens the source article.
- **Automation:** The data is refreshed via a cron job in `.github/workflows/ai-learning.yml`.

### 2. The Unsplash Photography Gallery (`_includes/photography.html`)
A custom 3-tab gallery showcasing Firdaus's photography directly from Unsplash.
- **Tabs:** "Most Viewed", "Favourites", and "Latest".
- **How it works:** A Node.js script (`.github/scripts/fetch_unsplash.js`) pulls data from the Unsplash API. 
- **Clever API Workaround:** To avoid exhausting the strict 50-request/hour Unsplash free tier limit, the script pulls the general photo lists, but *only* makes individual stats/views requests for the **Top 5 Most Viewed** photos. This keeps the total requests per run to exactly 8.
- **The UI:** Clean, grid-based layout. We removed the "likes/stats overlay" on hover for a cleaner, distraction-free aesthetic, but kept the raw view counts visible under the "Most Viewed" tab.
- **Automation:** Refreshed twice daily via `.github/workflows/unsplash.yml`.

### 3. Floating Table of Contents (`_includes/floating_toc.html`)
A hover-reveal sticky navigation tab fixed to the right edge of the screen (desktop only).
- **Collapsed state:** A small blue `☰` tab always visible at mid-screen right.
- **Expanded state:** Hovering slides open a panel with links to About, My Writing, and Photography.
- **Active tracking:** JS watches scroll position and highlights the current section link.
- **Anchor IDs:** `#about` (index.html), `#my-writing` (thoughts.html), `#photography` (photography.html).

---

## 🎨 Design Philosophy & UX Layout
- **The Sequence:** 
  1. **Bio** (Who am I?)
  2. **My Writing + AI Trivia** (The interactive hook + core content)
  3. **Photography** (The visual, aesthetic closer)
- **Styling:** We prioritized clean, modern UX. Features shouldn't just exist; they should be fun to use. The trivia game was specifically designed to hook visitors early and encourage them to click through to the full Medium articles.

---

## 🛠️ Where to Pick Up / Future Ideas
If you are starting a new session, here are some ideas for what to build next:
1. **Trivia Analytics:** Track how many questions users get right (locally in `localStorage` or via a lightweight database) and give them a score!
2. **More Unsplash Stats:** Could we safely pull total aggregate views across all time and display them as a milestone counter?
3. **Project Portfolio:** The "Projects" and "Interests" sections in `home.html` are currently commented out. They are prime candidates for a modern, animated grid layout overhaul.
