const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'youtube.json');
const THUMBS_DIR = path.join(__dirname, '..', '..', 'assets', 'youtube-thumbnails');

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// api.rss2json.com passes through YouTube's own RSS <title>/<description> text nodes verbatim -
// XML entity-escaped at the source (e.g. "Q&amp;A" for a title literally containing "Q&A") - and
// never decodes them itself. Left undecoded, "&amp;" shows up as literal, visible text in the UI
// instead of "&". No new dependency for this - just the handful of entities XML/HTML actually use
// in plain text content, plus numeric entities for anything else (emoji, non-ASCII punctuation).
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

// Same download/sync pattern as fetch_unsplash.js's syncLocalImages(): download straight into the
// repo instead of the frontend hotlinking i.ytimg.com on every visit. i.ytimg.com sets no
// meaningful cache-control headers (a real Lighthouse "efficient cache lifetimes" finding) and
// contributes to a "third-party cookie" Best Practices flag alongside Medium's own hotlinked
// images - self-hosting is the only real fix for headers this site doesn't control. hqdefault.jpg
// is a fixed, predictable URL (just videoId), so this needs no extra API call beyond the download
// itself.
async function downloadThumbnail(videoId, destPath) {
  const res = await fetch(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  if (!res.ok) throw new Error(`Failed to download thumbnail for ${videoId}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// Downloads any thumbnail (for a video actually in the final feed) not already saved locally, and
// removes any locally-saved thumbnail for a video that's fallen out of the feed - same
// download-missing/remove-stale shape as fetch_unsplash.js's own sync, just keyed by videoId
// instead of Unsplash photo id.
async function syncThumbnails(finalVideos) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const currentIds = new Set(finalVideos.map(v => v.videoId));
  const existingFiles = fs.readdirSync(THUMBS_DIR).filter(f => f.endsWith('.jpg'));
  const existingIds = new Set(existingFiles.map(f => f.slice(0, -4)));

  let downloaded = 0;
  for (const videoId of currentIds) {
    if (existingIds.has(videoId)) continue;
    try {
      await downloadThumbnail(videoId, path.join(THUMBS_DIR, `${videoId}.jpg`));
      downloaded++;
    } catch (err) {
      console.error(`Thumbnail download failed for ${videoId}, will retry next run:`, err.message);
    }
    await sleep(300); // polite to YouTube's CDN, matches fetch_unsplash.js's own PAGE_DELAY_MS
  }

  let removed = 0;
  for (const file of existingFiles) {
    if (!currentIds.has(file.slice(0, -4))) {
      fs.unlinkSync(path.join(THUMBS_DIR, file));
      removed++;
    }
  }

  console.log(`Thumbnail sync: ${downloaded} downloaded, ${removed} removed, ${currentIds.size} total.`);
}

const CHANNELS = [
  { url: "https://www.youtube.com/@aiDotEngineer", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@RyanLPeterman", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@aliabdaal", category: "Productivity" },
  { url: "https://www.youtube.com/@GoogleDevelopers", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/channel/UCSYUI0C0gG-Kp03GBaO2G9Q", category: "Finance" },
  { url: "https://www.youtube.com/channel/UCYkfgq8LmajU50WadNGGxtA", category: "Finance" },
  { url: "https://www.youtube.com/@TheGameOfImpossible", category: "General Ideas" },
  { url: "https://www.youtube.com/@bfmradiomy", category: "General Ideas" },
  { url: "https://www.youtube.com/@TEDx", category: "General Ideas" },
  { url: "https://www.youtube.com/@yaqeeninstituteofficial", category: "Islamic Studies" },
  { url: "https://www.youtube.com/@shabdullahoduro", category: "Islamic Studies" },
  { url: "https://www.youtube.com/@pragmaticengineer", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/channel/UCdMz6KKEDW_1Qqas-ya7S6w", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@keluarsekejap", category: "General Ideas" },
  { url: "https://www.youtube.com/@rafiziramli929", category: "General Ideas" },
  { url: "https://www.youtube.com/@mattpocockuk", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@DwarkeshPatel", category: "General Ideas" },
  { url: "https://www.youtube.com/@MuslimFounder", category: "Islamic Studies" },
  { url: "https://www.youtube.com/@ycombinator", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@bigthink", category: "General Ideas" },
  { url: "https://www.youtube.com/@kerissilicon", category: "Tech & Engineering" },
];

const DISCOVERY_QUERIES = [
  "junior software engineer advice",
  "software engineering career growth",
  "islamic finance principles",
  "muslim productivity tips",
  "malaysia tech startup scene",
  "life lessons for 20s"
];

// Helper to make an HTTP GET request
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

// Dynamically resolve a YouTube URL to a Channel ID
async function resolveChannelId(url) {
  if (url.includes('/channel/')) {
    return url.split('/channel/')[1];
  }
  try {
    const html = await fetchHtml(url);
    const match = html.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]+)">/);
    if (match) return match[1];
  } catch (err) {
    console.error(`Failed to resolve channel ID for ${url}`, err);
  }
  return null;
}

// Parses the handful of fields this script actually needs (title, link, author, pubDate,
// description) out of one <entry> block from YouTube's own Atom feed. Plain regex, not a real
// XML parser - safe here specifically because this is a single, consistent, YouTube-generated
// feed format (not arbitrary third-party XML), the same "hand-roll it, no new dependency for a
// well-understood fixed format" call this codebase already made for the PNG decoder used during
// this session's vignette debugging. `<title>` must be matched before `<media:group>` starts in
// each entry, since entries also carry a `<media:title>` with (usually) the same text - taking
// the first `<title>` match found in the entry substring is what keeps this the outer one, not
// the nested one.
function parseAtomEntry(entryXml) {
  const title = entryXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const link = entryXml.match(/<link rel="alternate" href="([^"]*)"/)?.[1] ?? '';
  const author = entryXml.match(/<author>\s*<name>([\s\S]*?)<\/name>/)?.[1] ?? '';
  const pubDate = entryXml.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? '';
  const description = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? '';
  return { title, link, author, pubDate, description };
}

// Fetch RSS feed - direct from YouTube's own public Atom feed, not api.rss2json.com. rss2json
// was just a JSON-converting middleman wrapping this exact same feed; its free tier started
// hard-rejecting new feed conversions ("You are converting new feeds in a very short period,
// please use an API key") partway through this list once it grew past ~10 channels, silently
// dropping every channel after that point from consideration on every single run - confirmed by
// testing all 21 channels directly against both paths. Fetching YouTube's own feed removes that
// rate-limited third party from the pipeline entirely: no new dependency, no new secret, and one
// less thing that can go down or change its pricing/limits out from under this script.
async function fetchRss(channelId) {
  try {
    const xml = await fetchHtml(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.map(parseAtomEntry);
  } catch (err) {
    console.error(`Failed to fetch RSS for ${channelId}`, err);
  }
  return [];
}

// Scrape YouTube search for Discovery feature
async function scrapeDiscoveryVideos(query) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    // Find video IDs
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let match;
    const videoIds = new Set();
    while ((match = regex.exec(html)) !== null) {
      videoIds.add(match[1]);
    }

    const results = [];
    for (const vid of videoIds) {
      // Very basic metadata extraction from the search HTML is complex due to minified state.
      // Instead, we just yield the URL, and Gemini will have to guess from the title if we provide it.
      // Actually, it's easier to find the video objects in ytInitialData
      const dataRegex = /var ytInitialData = (\{.*?\});<\/script>/;
      const dataMatch = html.match(dataRegex);
      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);
        // Dig into the insane YouTube JSON structure
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
        for (const item of contents) {
          if (item.videoRenderer) {
            results.push({
              // YouTube's own ytInitialData embeds these "runs[].text" strings HTML-escaped even
              // though they sit inside valid JSON - same underlying issue as fetchRss's XML feed,
              // just a different source.
              title: decodeHtmlEntities(item.videoRenderer.title.runs[0].text),
              link: `https://www.youtube.com/watch?v=${item.videoRenderer.videoId}`,
              thumbnail: item.videoRenderer.thumbnail.thumbnails[0].url,
              author: item.videoRenderer.ownerText?.runs[0]?.text
                ? decodeHtmlEntities(item.videoRenderer.ownerText.runs[0].text)
                : "YouTube Creator"
            });
          }
        }
      }
      break; // Only need the parsed JSON once
    }
    return results;
  } catch (err) {
    console.error(`Failed to scrape discovery for query: ${query}`, err);
    return [];
  }
}

// Call Gemini API (Fallback queue)
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
              // 8192 was tuned for the old ~30-candidate/top-5-only shape; the rss2json fix (up to
              // 63 candidates) plus the unbounded-selection prompt (verbose reasoning+summary per
              // pick, no cap) now regularly need more room than that, truncating the JSON mid-object.
              generationConfig: { temperature: 1.1, maxOutputTokens: 32768 }
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

// Evaluate Bulk Videos via Gemini
//
// The "pick EXACTLY the top 5" framing this replaced was validated against real labeled data
// (30+39 real candidates from actual runs, hand-labeled against what the site owner actually
// wanted to watch) as a genuine mismatch, not just a hunch: his real picks ran 40-64% of a
// batch, nowhere near a fixed top-5. A from-scratch rewrite via GEPA (reflective LLM-driven
// prompt optimization, dspy.GEPA) was tried first and failed - all 50 of its mutated candidates
// overfit to the specific training examples' titles and scored *worse* than this file's own
// original prompt on held-out data. What actually worked, tested the same way, was much
// smaller: dropping the fixed quota and telling the model to select based on genuine fit
// instead of an exclusive top-N cutoff (0.727 avg F1 across all 5 labeled batches vs. 0.699 for
// the old top-5 framing - and notably it wins specifically on the batches where he wanted the
// most videos, which the old fixed-5 cap structurally couldn't do regardless of how well it
// judged individual videos).
async function evaluateBulk(videoCandidates) {
  const prompt = `You are curating a YouTube feed for one specific person: a Muslim, Malaysian, junior fullstack software engineer early in his career, who also cares about Islamic finance. His core interests are: practical/applied software engineering and AI tooling (not academic AI research or formal math), Islamic finance and Malaysian business/economics, direct Islamic spiritual reminders, and career/productivity advice for someone early in their career.

You have been given a list of ${videoCandidates.length} recent YouTube video candidates. Decide which ones he would actually want to watch. There is no fixed quota - select as many or as few as genuinely fit those interests, whether that's 2 videos or 20. Don't apply an artificial "top N only" filter, but also don't pad the list - a video only belongs if it genuinely matches his actual interests above, not merely because it's plausible or well-produced. Deep academic/research AI content, generic TEDx talks, partisan politics, historical trivia, and pure promotional content should still be excluded regardless of how large the selection ends up being otherwise.

Here are the video candidates (in JSON format):
${JSON.stringify(videoCandidates, null, 2)}

CRITICAL INSTRUCTIONS:
1. Review the titles, channels, publish dates, and descriptions.
2. Provide a brief verdict ("reasoning") for EVERY SINGLE VIDEO on whether it is valuable or fluff.
3. Mark every video that genuinely fits his interests as "selected": true - no fixed count, judge each on its own merits. The rest must be false.
4. For every selected video, write a layman-friendly "summary" (2-3 sentences) explaining WHY it's worth their time. Make it intriguing and hook the viewer, but keep the tone natural and authentic.
5. Return ONLY valid JSON in the exact format below, with nothing else:
{
  "evaluations": [
    {
      "videoId": "the_videoId_here",
      "title": "The exact video title here",
      "selected": false,
      "reasoning": "This video is a generic vlog and provides no actionable advice.",
      "summary": ""
    },
    {
      "videoId": "another_videoId_here",
      "title": "The exact video title here",
      "selected": true,
      "reasoning": "Highly actionable breakdown of business scaling math.",
      "summary": "For a junior dev looking to level up their career, understanding the mechanics of a $100K business is eye-opening. It demystifies how value is created and scaled."
    }
  ]
}`;

  const responseText = await callGemini(prompt);
  return parseEvaluationResponse(responseText);
}

// Split out of evaluateBulk so this parsing/fallback behavior is testable against real response
// fixtures without a network call - this exact code path is what silently swallowed a truncated
// Gemini response in production (2026-08-19: a response cut off mid-object, missing the `},`/`{`
// boundary between two evaluations, since maxOutputTokens was too small for the candidate volume
// at the time) and fell all the way through to "Gemini did not select any valid videos today."
// with no other signal anything had gone wrong.
function parseEvaluationResponse(responseText) {
  if (!responseText) return [];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.evaluations || [];
    }
  } catch (err) {
    console.error("Failed to parse Gemini response", responseText);
  }
  return [];
}

// A video Gemini re-selects while it's still cycling through the rotating feed doesn't need
// Vertex AI to watch it again - it already has a real summary/timestamps from a previous run,
// sitting in _data/youtube.json's existingVideos. Only a *successful* past enrichment counts as
// reusable (non-empty timestamps) - an empty array means a past attempt failed all the way
// through enrichWithVideoSummary's own retries, and that's still worth trying fresh, same as the
// existing filteredExisting retry pass in main() does for videos that stayed in the feed.
function findReusableEnrichment(videoId, existingVideos) {
  const match = existingVideos.find(v => v.videoId === videoId);
  if (!match || !Array.isArray(match.timestamps) || match.timestamps.length === 0) return null;
  return { summary: match.summary, timestamps: match.timestamps, dateAdded: match.dateAdded };
}

// New function to enrich a video with an actual video summary from Vertex AI
//
// Retries with backoff, unlike an earlier version of this function — this is a separate Vertex
// AI client from callGemini()'s own generativelanguage.googleapis.com REST calls (needed here
// specifically for multimodal video understanding, which the text-only endpoint can't do), so it
// never got the same waterfall/retry protection CLAUDE.md's own rule requires for every
// Gemini-calling script. A single transient failure (rate limit, network blip, timeout on a
// longer video) silently fell all the way through to the empty-timestamps fallback with no
// second attempt — confirmed as the actual cause of at least one real video shipping with no
// timestamps despite having a normal-looking summary (the summary fallback and the timestamps
// fallback are the same code path, so a failed call still produces *a* summary, just never any
// timestamps, easy to miss without specifically checking for an empty array).
async function enrichWithVideoSummary(video) {
  if (!GCP_PROJECT_ID) {
    console.warn("GCP_PROJECT_ID not set, skipping Vertex AI video summary enrichment.");
    return video.summary; // Fallback to the short description-based summary
  }

  const ai = new GoogleGenAI({
    vertexai: {
      project: GCP_PROJECT_ID,
      location: 'us-central1'
    }
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\nWatching video via Vertex AI: ${video.title} (${video.url}) — attempt ${attempt}/${MAX_RETRIES}`);

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: video.url,
                  mimeType: 'video/mp4'
                }
              },
              {
                text: `You are an expert analyst and a persuasive copywriter. Watch this video and write a punchy, layman-friendly summary (2-3 sentences) that convinces the reader they need to watch this video, not just describes it. Lead with the single most compelling insight, payoff, or "aha" moment - make the value feel concrete and worth their time, the way a great hook or pitch would. Also extract 2-3 of the most valuable, cohesive segments (highlights) with an exact start time and end time in seconds.

CRITICAL GUARDRAILS:
1. Be highly skeptical. If the video contains obvious misinformation, scams, or questionable claims, flag it explicitly in your summary rather than hyping it up.
2. If the video touches on theology or philosophy, ensure your summary and highlighted takeaways do not promote anything that goes against core Islamic values.
3. ABSOLUTELY DO NOT hallucinate timestamps that exceed the actual length of the video. If it is a Short, all timestamps must be under 60 seconds.

You MUST return ONLY a valid JSON object in the exact format below, with nothing else:
{
  "summary": "Your persuasive, hook-driven 2-3 sentence summary...",
  "timestamps": [
    { "startTime": 135, "endTime": 180, "topic": "Explanation of the core concept" },
    { "startTime": 252, "endTime": 310, "topic": "Why this approach is a trap" }
  ]
}` }
            ]
          }
        ]
      });

      if (response && response.text) {
        console.log(`✓ Deep summary generated.`);
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
        console.error("Vertex AI response had no parseable JSON, will retry.");
      } else {
        console.error("Vertex AI returned an empty response, will retry.");
      }
    } catch (err) {
      console.error(`Vertex AI enrichment failed for ${video.url} (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
      // Used to treat any PERMISSION_DENIED as "this specific video is permanently blocked"
      // (uploader disabled embed/download access) and give up immediately, setting
      // enrichmentBlocked so it'd never be retried. That assumption is wrong often enough to be
      // dangerous: Google's own generateContent backend has real, dated community reports
      // (discuss.ai.google.dev, starting ~2026-08-13) of "403 PERMISSION_DENIED: The caller does
      // not have permission" on fileData/file_uri requests - this exact call shape - as a
      // *platform-side*, transient bug, with the identical request succeeding again later with no
      // client-side change. There's no reliable way to tell that apart from a genuine per-video
      // block from the message alone, and misclassifying the former as the latter means a video
      // that was simply unlucky enough to hit a transient window gets permanently blacklisted from
      // the feed instead of naturally succeeding on a later attempt - confirmed as the real cause
      // of the YouTube feed going a week+ with zero new videos despite fresh candidates being
      // selected every day (2026-09-01 investigation). Falling through to the normal per-attempt
      // retry loop below, same as any other error, is the safe default either way.
    }
    if (attempt < MAX_RETRIES) await sleep(attempt * 3000);
  }

  console.error(`Giving up on Vertex AI enrichment for ${video.url} after ${MAX_RETRIES} attempts.`);
  return { summary: video.summary, timestamps: [] }; // Fallback
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const videoCandidates = [];

  // 1. Roll for Discovery (20% chance)
  const roll = Math.random();
  if (roll < 0.20) {
    console.log("Discovery feature triggered!");
    const query = DISCOVERY_QUERIES[Math.floor(Math.random() * DISCOVERY_QUERIES.length)];
    console.log(`Searching YouTube for: ${query}`);
    const discoveryVids = await scrapeDiscoveryVideos(query);

    for (const vid of discoveryVids.slice(0, 3)) {
      videoCandidates.push({
        videoId: vid.link.split('v=')[1].split('&')[0],
        title: vid.title,
        channel: vid.author,
        category: "Discovery 🌍",
        publishDate: new Date().toISOString(),
        description: "A highly relevant video discovered via search.",
        url: vid.link
      });
    }
  }

  // 2. Fetch from ALL Channels
  console.log("Fetching latest videos from ALL channels...");
  for (const channel of CHANNELS) {
    const channelId = await resolveChannelId(channel.url);
    if (!channelId) continue;

    const videos = await fetchRss(channelId);
    await sleep(1500); // Polite pacing against youtube.com now that fetchRss hits it directly

    // Take top 3 recent videos per channel
    for (const vid of videos.slice(0, 3)) {
      const videoIdMatch = vid.link.match(/v=([a-zA-Z0-9_-]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : vid.link.split('/').pop();

      // Clean HTML tags from description and truncate to save tokens
      let cleanDesc = decodeHtmlEntities((vid.description || "").replace(/<[^>]*>?/gm, '').substring(0, 400).trim());

      videoCandidates.push({
        videoId: videoId,
        title: decodeHtmlEntities(vid.title),
        channel: vid.author ? decodeHtmlEntities(vid.author) : channel.category,
        category: channel.category,
        publishDate: vid.pubDate,
        description: cleanDesc,
        url: vid.link
      });
    }
  }

  console.log(`Collected ${videoCandidates.length} total video candidates. Sending to Gemini for bulk evaluation...`);

  if (videoCandidates.length === 0) {
    console.log("No candidates found to evaluate.");
    return;
  }

  const evaluations = await evaluateBulk(videoCandidates);
  // let, not const: filtered down to drop permanently-Vertex-AI-blocked videos further below.
  let curatedVideos = [];

  // Write the entire evaluation log for transparency
  if (evaluations.length > 0) {
    const evalLogFile = path.join(__dirname, '..', '..', '_data', 'youtube_eval_log.json');
    fs.writeFileSync(evalLogFile, JSON.stringify(evaluations, null, 2));
    console.log(`Successfully wrote ${evaluations.length} evaluation logs to ${evalLogFile}`);
  }

  for (const evalItem of evaluations) {
    if (!evalItem.selected) continue;

    // Match the selected ID back to our original candidate list
    const candidate = videoCandidates.find(v => v.videoId === evalItem.videoId);
    if (candidate) {
      curatedVideos.push({
        title: candidate.title,
        url: candidate.url,
        videoId: candidate.videoId,
        channel: candidate.channel,
        category: candidate.category,
        summary: evalItem.summary,
        dateAdded: new Date().toISOString()
      });
      console.log(`Added Winner: ${candidate.title}`);
    }
  }

  // Loaded here (not just further down at the merge step) so the Deep Summarization pass below
  // can check it too - a video Gemini re-selects while it's still cycling through the feed is
  // already in here with a real summary/timestamps, and doesn't need Vertex AI to watch it again.
  let existingVideos = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const raw = fs.readFileSync(OUTPUT_FILE);
      const data = JSON.parse(raw);
      existingVideos = data.videos || [];
    } catch (e) { }
  }

  // --------------------------------------------------------
  // NEW: Deep Summarization using Vertex AI
  // --------------------------------------------------------
  if (curatedVideos.length > 0 && GCP_PROJECT_ID) {
    console.log(`\n--- Starting Vertex AI Deep Summarization for ${curatedVideos.length} videos ---`);
    for (let i = 0; i < curatedVideos.length; i++) {
      const reusable = findReusableEnrichment(curatedVideos[i].videoId, existingVideos);
      if (reusable) {
        console.log(`Reusing existing enrichment for "${curatedVideos[i].title}" - already watched in a previous run, no need to re-run Vertex AI.`);
        curatedVideos[i].summary = reusable.summary;
        curatedVideos[i].timestamps = reusable.timestamps;
        curatedVideos[i].dateAdded = reusable.dateAdded || curatedVideos[i].dateAdded;
        continue;
      }

      const enriched = await enrichWithVideoSummary(curatedVideos[i]);
      if (typeof enriched === 'object' && enriched !== null) {
        curatedVideos[i].summary = enriched.summary || curatedVideos[i].summary;
        curatedVideos[i].timestamps = enriched.timestamps || [];
        if (enriched.enrichmentBlocked) curatedVideos[i].enrichmentBlocked = true;
      } else {
        curatedVideos[i].summary = enriched;
        curatedVideos[i].timestamps = [];
      }
    }

    // Drop rather than ship with no timestamps: a video Vertex AI is permanently blocked from
    // (see enrichWithVideoSummary's own comment) would otherwise sit in the feed indefinitely
    // with no "Key Moments" section for as long as it stayed in rotation. It never even
    // occupied a real feed slot from the visitor's perspective, so simply not including it costs
    // nothing beyond that day's batch being one video smaller.
    const blockedCount = curatedVideos.filter(v => v.enrichmentBlocked).length;
    if (blockedCount > 0) {
      console.log(`Dropping ${blockedCount} newly-curated video(s) Vertex AI is permanently blocked from.`);
      curatedVideos = curatedVideos.filter(v => !v.enrichmentBlocked);
    }
  }

  // Save to _data/youtube.json
  if (curatedVideos.length > 0) {
    const newVideoIds = new Set(curatedVideos.map(v => v.videoId));
    // decodeHtmlEntities() below only ever ran on freshly-fetched (curatedVideos) entries — a
    // video carried forward from a previous run's existingVideos never got re-decoded, so any
    // entry stored before this fix existed just kept rotating through the feed with its raw
    // "&amp;"/"&quot;" intact indefinitely, never healing on its own. Re-decoding here too closes
    // that gap for good, not just for whatever happened to be in the feed the day this was added.
    const filteredExisting = existingVideos
      .filter(v => !newVideoIds.has(v.videoId))
      .map(v => ({
        ...v,
        title: decodeHtmlEntities(v.title || ""),
        channel: v.channel ? decodeHtmlEntities(v.channel) : v.channel,
        description: v.description ? decodeHtmlEntities(v.description) : v.description,
      }));

    // Same "never retried once it's an existing entry" gap as the HTML-entity decode above, but
    // NOT fixed the same cheap-and-always way: re-decoding a string is a free no-op on already-
    // clean text, but re-enriching is a real Vertex AI video-watch call, so blindly re-running it
    // for every existing video on every run would burn quota on entries that already succeeded.
    // Retrying only the ones that still show timestamps: [] (an empty array specifically means a
    // past attempt failed all the way through enrichWithVideoSummary's own retries, not "no
    // timestamps were relevant") is the bounded, cost-appropriate version of the same fix — a
    // video that failed to enrich no longer stays stuck that way for as long as it happens to
    // remain in the rotating 15-video feed.
    //
    // !v.enrichmentBlocked excludes videos enrichWithVideoSummary gave up on permanently (a real
    // one: PERMISSION_DENIED, "User does not have access to the video" - Google's backend can't
    // ingest that specific video's content, typically because the uploader disabled embedding/
    // download access; it plays fine in a normal browser, but retrying the identical request
    // will never succeed). Without this, a permanently-blocked video would silently re-fail
    // every single run for as long as it stays in the rotating feed, burning MAX_RETRIES calls
    // each time for a result already known in advance.
    if (GCP_PROJECT_ID) {
      const needsRetry = filteredExisting.filter(v => Array.isArray(v.timestamps) && v.timestamps.length === 0 && !v.enrichmentBlocked);
      if (needsRetry.length > 0) {
        console.log(`\n--- Retrying Vertex AI enrichment for ${needsRetry.length} existing video(s) with empty timestamps ---`);
        for (const video of needsRetry) {
          const enriched = await enrichWithVideoSummary(video);
          if (typeof enriched === 'object' && enriched !== null) {
            video.summary = enriched.summary || video.summary;
            video.timestamps = enriched.timestamps || [];
            if (enriched.enrichmentBlocked) video.enrichmentBlocked = true;
          }
        }
      }
    }

    // filteredExisting can carry enrichmentBlocked two ways: freshly set by the retry pass just
    // above, or already sitting in _data/youtube.json from a previous run (retried and blocked
    // before, or GCP_PROJECT_ID wasn't set this run so the retry pass didn't touch it at all) —
    // excluding it here catches both, not just the ones this specific run happened to retry.
    const finalVideos = [...curatedVideos, ...filteredExisting.filter(v => !v.enrichmentBlocked)].slice(0, 15); // Keep up to 15 in the feed

    await syncThumbnails(finalVideos);

    const finalOutput = {
      videos: finalVideos,
      lastUpdated: new Date().toISOString()
    };

    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2));
    console.log(`Successfully wrote ${finalVideos.length} videos to ${OUTPUT_FILE}`);
  } else {
    console.log("Gemini did not select any valid videos today.");
  }
}

// Guards against main() running as a side effect of require()-ing this file for its exports (a
// real, not hypothetical, hazard once tests started importing from it - see fetch_youtube.test.js
// for the actual failure this caught: requiring the file for decodeHtmlEntities/parseAtomEntry
// unconditionally ran the live script, tripping the missing-GEMINI_API_KEY process.exit(1) below).
// No effect on the normal `node fetch_youtube.js` invocation the GitHub Actions workflow uses.
if (require.main === module) {
  main();
}

module.exports = { decodeHtmlEntities, parseAtomEntry, parseEvaluationResponse, findReusableEnrichment };
