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
- **How it works:** A Node.js script fetches Medium articles, processes them via Gemini, and stores questions in `_data/learning.json`.
- **The Layout:** The section is explicitly decoupled from the Medium articles column to prevent layout stretching. The Articles column has a responsive height (`450px` on mobile, `648px` on desktop) with `overflow: hidden` to safely contain the internal scrolling without bleeding or overlapping the trivia widget below it.
- **The UI:** The front-end reads this JSON and builds an interactive quiz. It features:
  - Green/Red validation states with CSS shake animations for wrong answers.
  - Linear `<` `>` pagination controls to scroll back and forth, replacing randomized queues.
  - A category filter linked to the Medium articles filter. The subtitle dynamically updates to reflect the active filter (e.g. "from my **software** articles!").
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

### 3. Reclaiming the Algo (Mindful YouTube Feed) (`_includes/youtube_feed.html`)
A curated, single-video feed designed to bypass the overwhelming YouTube algorithm and provide intentional, self-improvement-focused viewing.
- **How it works:** A Node script (`.github/scripts/fetch_youtube.js`) iterates over a hardcoded list of pre-approved channels (e.g., Tech, Productivity, Islamic Studies). It dynamically resolves `@handles` to channel IDs by fetching the channel HTML and extracting the `<meta itemprop="identifier">`.
- **The "Discovery" Feature:** 20% of the time, the script performs a keyword search on YouTube to find top videos from an *unknown* channel, injecting them into the candidate pool to ensure the user isn't trapped in an algorithmic bubble.
- **Bulk AI Evaluation:** The script gathers the top 3 most recent videos from ALL channels (plus Discovery videos), cleans their descriptions, and bundles them into a single master JSON array. This array is sent to Gemini in one massive API call, forcing the AI to act as a "brutal talent scout" to compare them all simultaneously and select the absolute top 5.
- **Deep Vertex AI Summary:** After the top 5 are selected, the script uses **Vertex AI** via Google Cloud (`google-github-actions/auth@v2` with **Workload Identity Federation (WIF)** for keyless enterprise-grade security) to "watch" the top 5 videos. It extracts highly specific 2-3 sentence summaries with exact timestamps and bullet points. It also includes strict guardrails to flag misinformation and ensure content aligns with Islamic values.
- **Comprehensive Logging:** To maintain transparency, Gemini outputs its reasoning for *every single video* (both selected and rejected). The 5 winners are saved to `_data/youtube.json`, and the entire thought process is dumped into a permanent `_data/youtube_eval_log.json` file for the user to read.
- **The UI:** Sits between Gratitude and Photography. Uses a split-pane layout with the embedded YouTube player on the left and the AI summary on the right. Shows one video at a time with a "Next Video" button to cycle through `_data/youtube.json`. It features **Clickable Jump-To Timestamps** which parse the Vertex AI timestamp JSON array and hook directly into the YouTube IFrame API, allowing users to instantly skip the video to exact moments without reloading the player.
- **Automation:** Refreshed daily via `.github/workflows/ai-daily-content.yml`.

### 4. Floating Table of Contents (`_includes/floating_toc.html`)
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
- **AI Priority Queue & Circuit Breakers:** The front-end uses a `suggestionQueue` that automatically merges fresh AI-generated suggestions with hardcoded defaults. It shuffles both arrays separately and places the AI suggestions at the *front* of the queue, guaranteeing users see 100% of the fresh AI suggestions first. Furthermore, a global "circuit breaker" (`window.currentTypingTimeout`) instantly kills any overlapping typewriter loops if the user spams the Suggest button.
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
- **Collapsible Architecture:** To prevent the homepage from becoming infinitely long, all major sections (My Writing, Gratitude, Photography) are natively wrapped in `<details open>` tags. The `<h2>` headers act as the `<summary>`. This is highly performant (zero JS) and ensures mobile/desktop users can hide sections they've already seen.

---

## 🤖 AI API Scripts, Orchestration & Waterfall Fallbacks
The daily AI content (Trivia, Gratitude, YouTube) is generated by Node scripts that hit the Gemini API via GitHub Actions.

- **The Orchestrator Architecture:** Instead of a single monolithic workflow, the actions are split into modular, reusable child workflows (`ai-youtube.yml`, `ai-gratitude.yml`, `ai-learning.yml`). This allows them to be triggered individually on demand. They are bound together by a master orchestrator (`ai-daily-content.yml`) which runs daily. 
- **API Limits:** Because Gemini's Free Tier has extremely strict rate limits (e.g., 20 Requests Per Day on 3.5 Flash), the API scripts use a **Waterfall Fallback Queue**. The script tries the smartest model first, and if it encounters a `429` (Quota) or `503` (High Demand) error, it gracefully degrades to lighter models (like `gemini-3.1-flash-lite`) to guarantee pipeline uptime.

---

## 🛠️ Where to Pick Up / Future Ideas
If you are starting a new session, here are some ideas for what to build next:
1. **Trivia Analytics:** Track how many questions users get right (locally in `localStorage` or via a lightweight database) and give them a score!
2. **More Unsplash Stats:** Could we safely pull total aggregate views across all time and display them as a milestone counter?
3. **Project Portfolio:** The "Projects" and "Interests" sections in `home.html` are currently commented out. They are prime candidates for a modern, animated grid layout overhaul.
