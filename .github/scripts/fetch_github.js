const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'trending.json');
const TRENDING_URL = 'https://github.com/trending?since=weekly';

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same entity-decoding need as fetch_youtube.js's own copy - GitHub's trending page passes repo
// descriptions through HTML-escaped (e.g. "Beautiful, Modern &amp; Opinionated" for a description
// literally containing "&"), and doesn't decode them itself. No shared module between this
// repo's scripts (each is independently installed/run by its own workflow), so this stays a small
// duplicated helper rather than a new cross-script dependency - matches the existing convention.
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&(#x[0-9a-fA-F]+|#[0-9]+);/g, (_, code) =>
      String.fromCodePoint(code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function fetchTrendingHtml() {
  const res = await fetch(TRENDING_URL);
  if (!res.ok) throw new Error(`Failed to fetch trending page: HTTP ${res.status}`);
  return res.text();
}

// GitHub's own stable, official redirect (confirmed via a real request: 302s to
// avatars.githubusercontent.com/u/{id}) - works for both user and org accounts, so it's used for
// both the repo owner and each "Built by" contributor rather than the differently-shaped src=
// URLs GitHub's own markup happens to embed for the latter. One helper, one derivation, for both.
function avatarUrlFor(username) {
  return `https://github.com/${username}.png`;
}

// Parses the handful of fields this script actually needs out of one <article class="Box-row">
// block - GitHub's own trending-page markup, confirmed against real fetched HTML (not guessed):
// the repo's full name and URL come straight from the h2 link's href (not the link text, which is
// split across "owner /" and the repo name in separate text nodes with awkward whitespace),
// description from the col-9 paragraph, language from the itemprop attribute Google/GitHub already
// use for their own SEO markup, and "stars this week" (the actual trending signal, distinct from
// lifetime stars) from the trailing summary span. Plain regex, not a real HTML parser - same
// "single, consistent, machine-generated format" justification this codebase already used for the
// YouTube Atom feed parser and the PNG decoder.
//
// contributorUsernames comes from the page's own "Built by" section - confirmed (via a real fetch
// across all 18 live entries) that this always caps at a handful of avatars regardless of a
// repo's true contributor count, so this is deliberately NOT used to derive or claim any kind of
// total contributor count - just used to render a small, honest "some people worked on this"
// avatar stack, never a number.
function parseTrendingEntry(articleHtml) {
  const fullName = articleHtml.match(/<h2[^>]*>\s*<a[^>]*?href="\/([^"]+)"/)?.[1] ?? '';
  const description = decodeHtmlEntities(
    (articleHtml.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '').trim()
  );
  const language = articleHtml.match(/itemprop="programmingLanguage">([^<]*)</)?.[1] ?? '';
  const starsThisWeekMatch = articleHtml.match(/([\d,]+)\s*stars? this week/);
  const starsThisWeek = starsThisWeekMatch ? parseInt(starsThisWeekMatch[1].replace(/,/g, ''), 10) : 0;
  const totalStarsMatch = articleHtml.match(/\/stargazers"[^>]*>[\s\S]*?([\d,]+)<\/a>/);
  const totalStars = totalStarsMatch ? parseInt(totalStarsMatch[1].replace(/,/g, ''), 10) : 0;
  const owner = fullName.split('/')[0] ?? '';

  // Bounded by the "N stars this week" span that always follows it - an unbounded match would
  // run past this article's own "Built by" section into whatever comes next.
  const builtByMatch = articleHtml.match(/Built by([\s\S]*?)<span data-view-component="true" class="d-inline-block float-sm-right">/);
  const contributorUsernames = builtByMatch
    ? [...builtByMatch[1].matchAll(/alt="@([a-zA-Z0-9_-]+)"/g)].map(m => m[1]).filter(u => u !== owner)
    : [];

  return {
    fullName,
    url: fullName ? `https://github.com/${fullName}` : '',
    description,
    language,
    starsThisWeek,
    totalStars,
    ownerAvatarUrl: owner ? avatarUrlFor(owner) : '',
    contributorAvatarUrls: contributorUsernames.map(avatarUrlFor)
  };
}

function parseTrendingPage(html) {
  const articles = html.match(/<article class="Box-row">[\s\S]*?<\/article>/g) || [];
  return articles.map(parseTrendingEntry).filter(r => r.fullName);
}

// Call Gemini API (Fallback queue) - identical waterfall/retry shape to fetch_youtube.js's own
// callGemini, duplicated rather than shared for the same "no cross-script module" reason as
// decodeHtmlEntities above.
let currentModelIndex = 0;

async function callGemini(prompt) {
  while (currentModelIndex < GEMINI_MODELS.length) {
    const model = GEMINI_MODELS[currentModelIndex];
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 1, maxOutputTokens: 32768 }
            })
          }
        );

        const data = await res.json();

        if (res.status === 429 || res.status === 503) {
          const waitMs = attempt * 3000;
          console.warn(`API Error (${res.status}) on ${model}. Attempt ${attempt}/${MAX_RETRIES}. Retrying in ${waitMs / 1000}s...`);
          if (attempt === MAX_RETRIES) {
            console.warn(`Max retries reached for ${model}. Permanently falling back to next model...`);
            currentModelIndex++;
            break;
          }
          await sleep(waitMs);
          continue;
        }

        if (!res.ok || !data.candidates || data.candidates.length === 0) {
          currentModelIndex++;
          break; // Hard error
        }
        return data.candidates[0].content.parts[0].text.trim();
      } catch (err) {
        console.error(`Fetch error on ${model}: ${err.message}`);
        currentModelIndex++;
        break;
      }
    }
  }
  return null;
}

// Personalization paragraph deliberately stays at category level, not identifiers - see
// PROFILE.md's "How to use this" and docs/adr/0001-manual-profile-for-content-personalization.md
// for why: this file is committed and public, PROFILE.md is not and is never read at runtime, so
// only a hand-distilled summary belongs here, not specific project names/URLs or employer industry.
function buildHookPrompt(repos) {
  return `You are writing short, plain-language introductions to this week's trending GitHub repositories for one specific reader: a Muslim, Malaysian, junior fullstack software engineer who actively evaluates AI coding tools and does applied AI/ML engineering work (prompt evaluation and optimization, not academic research), and who builds side projects that combine Islamic ethics with software engineering. He also follows Islamic finance.

Here are this week's trending repos (in JSON format):
${JSON.stringify(repos, null, 2)}

CRITICAL INSTRUCTIONS:
1. For EVERY repo listed, write a "hook" - a plain-language explanation of what it does. Follow strict Simplified Technical English (ASD-STE100) rules: short sentences (under 20 words each), one idea per sentence, active voice, plain everyday words. If you use a technical term, explain it in the very next sentence rather than assuming it's already understood.
2. Do not skip or exclude any repo - this list is already curated by GitHub's own trending algorithm, so every repo gets a hook. There is no selection step here.
3. Only if there is a genuine, non-forced connection to the reader's real interests above, add one short "personalization" line explaining why it might matter to him specifically. If there's no real fit, set "personalization" to an empty string - do not stretch for a connection that isn't actually there.
4. Return ONLY valid JSON in the exact format below, with nothing else:
{
  "repos": [
    {
      "fullName": "owner/repo",
      "hook": "Plain language explanation in STE100 style.",
      "personalization": "One short line, or empty string if there's no genuine fit."
    }
  ]
}`;
}

// Split out of writeHooks so this parsing/fallback behavior is directly testable against response
// fixtures without a network call - fetch_youtube.js's own evaluateBulk/parseEvaluationResponse
// split exists for the exact same reason, after a truncated Gemini response in production silently
// fell through to "no videos selected" with no other signal anything had gone wrong. Catching that
// here, from the start, is cheaper than rediscovering the same bug a second time in a second script.
function parseHookResponse(responseText) {
  if (!responseText) return [];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.repos || [];
    }
  } catch (err) {
    console.error("Failed to parse Gemini response", responseText);
  }
  return [];
}

async function writeHooks(repos) {
  const prompt = buildHookPrompt(repos);
  const responseText = await callGemini(prompt);
  return parseHookResponse(responseText);
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  console.log(`Fetching trending repos from ${TRENDING_URL}...`);
  const html = await fetchTrendingHtml();
  const repos = parseTrendingPage(html);
  console.log(`Parsed ${repos.length} trending repos.`);

  if (repos.length === 0) {
    console.log("No trending repos found - GitHub's markup may have changed.");
    return;
  }

  const hooks = await writeHooks(repos);
  const hooksByName = new Map(hooks.map(h => [h.fullName, h]));

  const finalRepos = repos.map(repo => {
    const hook = hooksByName.get(repo.fullName);
    return {
      ...repo,
      hook: hook?.hook || '',
      personalization: hook?.personalization || ''
    };
  }).filter(r => r.hook); // A repo Gemini didn't return a hook for isn't worth shipping with blank copy.

  // This isn't curation (the design deliberately has none - every repo GitHub's own trending
  // algorithm surfaces gets a hook, no selection step) - it's a safety net for a well-formed but
  // incomplete response (Gemini's JSON parses fine but simply omits an entry for one repo out of
  // the batch), distinct from parseHookResponse's own truncated-response handling (a fully
  // malformed response returns [] for everything, already visible via the "did not return any
  // usable hooks" log below). Silently shipping a shorter list with no trace of *why* it's
  // shorter would be exactly the kind of silent content-loss this whole file's test suite exists
  // to catch - logging which specific repos got dropped keeps it diagnosable instead.
  const droppedCount = repos.length - finalRepos.length;
  if (droppedCount > 0) {
    const droppedNames = repos.filter(r => !hooksByName.get(r.fullName)?.hook).map(r => r.fullName);
    console.warn(`Gemini's response didn't include a hook for ${droppedCount} repo(s), dropped from today's list: ${droppedNames.join(', ')}`);
  }

  if (finalRepos.length === 0) {
    console.log("Gemini did not return any usable hooks today.");
    return;
  }

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    repos: finalRepos,
    lastUpdated: new Date().toISOString()
  }, null, 2));
  console.log(`Successfully wrote ${finalRepos.length} trending repos to ${OUTPUT_FILE}`);
}

// Guards against main() running as a side effect of require()-ing this file for its exports - see
// fetch_youtube.js's identical guard and its own comment for the real failure this prevents.
if (require.main === module) {
  main();
}

module.exports = { decodeHtmlEntities, parseTrendingEntry, parseTrendingPage, parseHookResponse };
