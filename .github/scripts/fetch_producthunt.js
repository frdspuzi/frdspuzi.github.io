const fs = require('fs');
const path = require('path');

const PRODUCTHUNT_API_TOKEN = process.env.PRODUCTHUNT_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'producthunt.json');
const GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Daily, not weekly - confirmed via a real week of live data (2026-08-22 investigation) that a
// weekly-only cadence structurally discards real content here: unlike GitHub trending (weekly
// smooths noise over repos that substantially reappear day to day - see github-trending.yml's own
// comment), a Product Hunt product launches once and never reappears, so a week's weeklyRank list
// only ever reflects 3-4 of that week's 7 days - the rest are gone, not deduped. Querying "today"
// directly via postedAfter/postedBefore + order: RANKING sidesteps weeklyRank entirely.
function todayWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { postedAfter: start.toISOString(), postedBefore: end.toISOString() };
}

// GraphQL, not REST - Product Hunt only exposes v2 as GraphQL (api.producthunt.com/v2/api/graphql).
// order: RANKING matches what the public daily leaderboard actually shows (Product Hunt's own
// ranking algorithm, not a plain vote sort) - confirmed against real data during the 2026-08-22
// cadence investigation. first: 20 is comfortably above the ~10 the frontend ever actually uses
// (see TrendingSection.tsx's own top-N slicing) - some headroom in case Gemini drops a hook for a
// couple of entries, same safety margin fetch_github.js's own list already has.
async function fetchTodaysPosts() {
  const { postedAfter, postedBefore } = todayWindow();
  const query = `
    query {
      posts(postedAfter: "${postedAfter}", postedBefore: "${postedBefore}", order: RANKING, first: 20) {
        edges {
          node {
            name
            tagline
            url
            website
            votesCount
            dailyRank
            thumbnail { url }
            makers { name profileImage }
            topics(first: 3) { edges { node { name } } }
          }
        }
      }
    }
  `;

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PRODUCTHUNT_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) throw new Error(`Product Hunt API request failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(`Product Hunt API returned errors: ${JSON.stringify(data.errors)}`);
  return data.data?.posts?.edges ?? [];
}

// Some makers come back with name: "[REDACTED]" and profileImage: null (confirmed against real
// API responses - presumably a private/opted-out profile) - filtered out here rather than shown as
// an anonymous avatar, matching fetch_github.js's own "never render a claim that isn't real" bar
// for the contributor stack.
function parsePost(edge) {
  const node = edge.node;
  const makers = (node.makers || []).filter((m) => m.profileImage && m.name !== '[REDACTED]');

  return {
    name: node.name,
    tagline: node.tagline,
    url: node.url,
    website: node.website,
    votesCount: node.votesCount,
    dailyRank: node.dailyRank,
    thumbnailUrl: node.thumbnail?.url ?? '',
    makerNames: makers.map((m) => m.name),
    makerAvatarUrls: makers.map((m) => m.profileImage),
    topics: (node.topics?.edges ?? []).map((e) => e.node.name)
  };
}

function parsePosts(edges) {
  return edges.map(parsePost).filter((p) => p.name);
}

// Identical waterfall/retry shape to fetch_github.js's own callGemini - duplicated rather than
// shared, matching this repo's existing "no cross-script module" convention (each script is
// independently installed/run by its own workflow).
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

// Personalization paragraph deliberately stays at category level, not identifiers - same rule as
// fetch_github.js's own buildHookPrompt, see PROFILE.md's "How to use this" and
// docs/adr/0001-manual-profile-for-content-personalization.md for why.
function buildHookPrompt(posts) {
  return `You are writing short, plain-language introductions to today's top Product Hunt launches for one specific reader: a Muslim, Malaysian, junior fullstack software engineer who actively evaluates AI coding tools and does applied AI/ML engineering work (prompt evaluation and optimization, not academic research), and who builds side projects that combine Islamic ethics with software engineering. He also follows Islamic finance.

Here are today's top Product Hunt launches (in JSON format):
${JSON.stringify(posts, null, 2)}

CRITICAL INSTRUCTIONS:
1. For EVERY product listed, write a "hook" - a plain-language explanation of what it does and who it's for. Follow strict Simplified Technical English (ASD-STE100) rules: short sentences (under 20 words each), one idea per sentence, active voice, plain everyday words. If you use a technical term, explain it in the very next sentence rather than assuming it's already understood.
2. Do not skip or exclude any product - this list is already curated by Product Hunt's own ranking algorithm, so every product gets a hook. There is no selection step here.
3. Only if there is a genuine, non-forced connection to the reader's real interests above, add one short "personalization" line explaining why it might matter to him specifically. If there's no real fit, set "personalization" to an empty string - do not stretch for a connection that isn't actually there.
4. Return ONLY valid JSON in the exact format below, with nothing else:
{
  "posts": [
    {
      "name": "Product Name",
      "hook": "Plain language explanation in STE100 style.",
      "personalization": "One short line, or empty string if there's no genuine fit."
    }
  ]
}`;
}

// Split out of writeHooks for the same reason as fetch_github.js's own parseHookResponse - directly
// testable against response fixtures without a network call.
function parseHookResponse(responseText) {
  if (!responseText) return [];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.posts || [];
    }
  } catch (err) {
    console.error("Failed to parse Gemini response", responseText);
  }
  return [];
}

async function writeHooks(posts) {
  const prompt = buildHookPrompt(posts);
  const responseText = await callGemini(prompt);
  return parseHookResponse(responseText);
}

async function main() {
  if (!PRODUCTHUNT_API_TOKEN) {
    console.error("PRODUCTHUNT_API_TOKEN is not set.");
    process.exit(1);
  }
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  console.log("Fetching today's Product Hunt posts...");
  const edges = await fetchTodaysPosts();
  const posts = parsePosts(edges);
  console.log(`Parsed ${posts.length} Product Hunt posts.`);

  if (posts.length === 0) {
    console.log("No Product Hunt posts found for today.");
    return;
  }

  const hooks = await writeHooks(posts);
  const hooksByName = new Map(hooks.map(h => [h.name, h]));

  const finalPosts = posts.map(post => {
    const hook = hooksByName.get(post.name);
    return {
      ...post,
      hook: hook?.hook || '',
      personalization: hook?.personalization || ''
    };
  }).filter(p => p.hook); // A post Gemini didn't return a hook for isn't worth shipping with blank copy.

  // Same "log what got dropped, don't ship a silently shorter list" safety net as fetch_github.js.
  const droppedCount = posts.length - finalPosts.length;
  if (droppedCount > 0) {
    const droppedNames = posts.filter(p => !hooksByName.get(p.name)?.hook).map(p => p.name);
    console.warn(`Gemini's response didn't include a hook for ${droppedCount} post(s), dropped from today's list: ${droppedNames.join(', ')}`);
  }

  if (finalPosts.length === 0) {
    console.log("Gemini did not return any usable hooks today.");
    return;
  }

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    posts: finalPosts,
    lastUpdated: new Date().toISOString()
  }, null, 2));
  console.log(`Successfully wrote ${finalPosts.length} Product Hunt posts to ${OUTPUT_FILE}`);
}

// Guards against main() running as a side effect of require()-ing this file for its exports - see
// fetch_github.js's identical guard and its own comment for the real failure this prevents.
if (require.main === module) {
  main();
}

module.exports = { parsePost, parsePosts, parseHookResponse, todayWindow };
