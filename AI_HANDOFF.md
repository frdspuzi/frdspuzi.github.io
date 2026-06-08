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
- **How it works:** A Node.js script
### 2. The Scripts (`generate_learning.js` & `generate_gratitude.js`)
*   These Node.js scripts fetch the user's Medium RSS feed, pass the article content to the Gemini API, and request a JSON response containing a trivia question/learning or a gratitude entry.
*   **Prompt Angles**: The learning script uses "prompt angles" (e.g., philosophy, actionable takeaway, misconception) coupled with a high temperature (`1.1`) to ensure the AI doesn't generate the same repetitive trivia questions every day.
*   **Waterfall Fallback Architecture**: Because the Gemini Free Tier has extremely strict limits (e.g., `gemini-3.5-flash` allows only 20 Requests Per Day), the API calls use a Waterfall Fallback Queue (`GEMINI_MODELS` array). It tries the smartest model first, and if it encounters a `429` (Quota) or `503` (High Demand) error, it gracefully degrades to lighter models (like `gemini-3.1-flash-lite` which has 500 RPD) to guarantee 100% pipeline uptime.
*   The scripts write directly to `_data/learning.json` and `_data/gratitude.json`.mized, domain-agnostic "prompt angle" (e.g. "Focus on a misconception" or "Focus on a surprising detail") into the Gemini prompt.
- **The UI:** The front-end reads this JSON and builds an interactive quiz. It features:
  - Green/Red validation states with CSS shake animations for wrong answers.
  - An endless loop "Skip Question" / "Next Question" button. A **shuffled queue** cycles through all questions in random order before any repeats, so the same question is never shown twice in a row.
  - A **"Not sure? Read: [article title]"** label above the options — serves as both the article attribution and the hint link in one, removing redundancy.
  - The article title is shown above the answer options before the user answers.
- **Automation:** The data is refreshed via a cron job in `.github/workflows/ai-daily-content.yml` (combined with gratitude generation).

### 2. The Unsplash Photography Gallery (`_includes/photography.html`)
A custom 3-tab gallery showcasing Firdaus's photography directly from Unsplash.
- **Tabs:** "Most Viewed", "Favourites", and "Latest".
- **How it works:** A Node.js script (`.github/scripts/fetch_unsplash.js`) pulls data from the Unsplash API. 
- **Clever API Workaround:** To avoid exhausting the strict 50-request/hour Unsplash free tier limit, the script pulls the general photo lists, but *only* makes individual stats/views requests for the **Top 5 Most Viewed** photos. This keeps the total requests per run to exactly 8.
- **The UI:** Clean, grid-based layout. We removed the "likes/stats overlay" on hover for a cleaner, distraction-free aesthetic, but kept the raw view counts visible under the "Most Viewed" tab.
- **Automation:** Refreshed twice daily via `.github/workflows/unsplash.yml`.

### 3. Floating Table of Contents (`_includes/floating_toc.html`)
A hover-reveal sticky navigation tab fixed to the **top-left** edge of the screen (desktop only, hidden on mobile).
- **Collapsed state:** A small blue `☰` tab pinned to the top-left. Panel slides out **rightward** on hover.
- **Expanded state:** Shows links to About, My Writing, Gratitude, and Photography in page order.
- **Click fix:** Links use `<button>` + `scrollIntoView({ behavior: 'smooth' })` instead of `href` anchors — this ensures every click works, including repeated clicks on the same section (native anchor links are a no-op if the hash is already set).
- **Active tracking:** JS watches scroll position (top 40% threshold) and highlights the current section.
- **Anchor IDs:** `#about` (`<span>` in index.html), `#my-writing` (thoughts.html h2), `#gratitude` (gratitude.html h2), `#photography` (photography.html h2).
- **Page order:** `_layouts/home.html` (stacked layout) renders sections in the correct order: About → My Writing → Gratitude → Photography.

### 4. Gratitude Journal Section (`_includes/gratitude.html`)
A private, client-side only section to encourage users to reflect on what they're grateful for.
- **How it works:** A simple text area for users to type their thoughts. The input is never saved, tracked, or sent to a database.
- **AI Suggestions:** Includes an "AI Suggestion" button that simulates an AI generating contextually relevant gratitude prompts using a typewriter effect. 
- **Dynamic Content:** The suggestions are generated dynamically by a Node script (`.github/scripts/generate_gratitude.js`) using the Gemini 3.5 Flash API. The prompt subtly asks for themes relatable to a mid-20s Malaysian software engineer (e.g., *teh tarik*, *Fajr*, *bugs*, *rezeki*). The data is saved to `_data/gratitude.json`.
- **Automation:** Refreshed daily via `.github/workflows/ai-daily-content.yml`.
- **Inspiration:** Features Surah Ibrahim (14:7) to reinforce the value of gratitude.
- **Location:** Positioned between "My Writing" and "Photography" on the home page.

---

## 🎨 Design Philosophy & UX Layout
- **The Sequence:** 
  1. **Bio** (Who am I?)
  2. **My Writing + AI Trivia** (The interactive hook + core content)
  3. **Gratitude** (A mindful pause)
  4. **Photography** (The visual, aesthetic closer)
- **Styling:** We prioritized clean, modern UX. Features shouldn't just exist; they should be fun to use. The trivia game was specifically designed to hook visitors early and encourage them to click through to the full Medium articles.

---

## 🛠️ Where to Pick Up / Future Ideas
If you are starting a new session, here are some ideas for what to build next:
1. **Trivia Analytics:** Track how many questions users get right (locally in `localStorage` or via a lightweight database) and give them a score!
2. **More Unsplash Stats:** Could we safely pull total aggregate views across all time and display them as a milestone counter?
3. **Project Portfolio:** The "Projects" and "Interests" sections in `home.html` are currently commented out. They are prime candidates for a modern, animated grid layout overhaul.
