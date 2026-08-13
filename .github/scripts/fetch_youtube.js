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

// Fetch RSS feed
async function fetchRss(channelId) {
  try {
    // using api.rss2json.com is easiest for XML -> JSON, but has rate limits.
    // However, since we're running daily, 10 requests is perfectly fine.
    const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await fetch(rssUrl);
    const data = await res.json();
    if (data.status === 'ok') {
      return data.items || [];
    }
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
              generationConfig: { temperature: 1.1, maxOutputTokens: 8192 }
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
async function evaluateBulk(videoCandidates) {
  const prompt = `You are an expert content curator. You have been given a massive list of ${videoCandidates.length} recent YouTube videos.
Your job is to act like a brutal talent scout and pick the absolute best 5 videos from this list that provide the highest value for our target demographic:
- A Muslim
- A Malaysian
- A Junior Fullstack Software Engineer
- Someone early in their career seeking advice
- An Islamic financial advocate

Here are the video candidates (in JSON format):
${JSON.stringify(videoCandidates, null, 2)}

CRITICAL INSTRUCTIONS:
1. Review the titles, channels, publish dates, and descriptions.
2. Provide a brief verdict ("reasoning") for EVERY SINGLE VIDEO on whether it is valuable or fluff.
3. Mark EXACTLY the top 5 most genuinely valuable videos as "selected": true. The rest must be false.
4. For the 5 selected videos ONLY, write a layman-friendly "summary" (2-3 sentences) explaining WHY it's worth their time. Make it intriguing and hook the viewer, but keep the tone natural and authentic.
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
    await sleep(1500); // Prevent hitting rss2json rate limits

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
  const curatedVideos = [];

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

  // --------------------------------------------------------
  // NEW: Deep Summarization using Vertex AI
  // --------------------------------------------------------
  if (curatedVideos.length > 0 && GCP_PROJECT_ID) {
    console.log(`\n--- Starting Vertex AI Deep Summarization for ${curatedVideos.length} videos ---`);
    for (let i = 0; i < curatedVideos.length; i++) {
      const enriched = await enrichWithVideoSummary(curatedVideos[i]);
      if (typeof enriched === 'object' && enriched !== null) {
        curatedVideos[i].summary = enriched.summary || curatedVideos[i].summary;
        curatedVideos[i].timestamps = enriched.timestamps || [];
      } else {
        curatedVideos[i].summary = enriched;
        curatedVideos[i].timestamps = [];
      }
    }
  }

  // Save to _data/youtube.json
  if (curatedVideos.length > 0) {
    let existingVideos = [];
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const raw = fs.readFileSync(OUTPUT_FILE);
        const data = JSON.parse(raw);
        existingVideos = data.videos || [];
      } catch (e) { }
    }

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
    if (GCP_PROJECT_ID) {
      const needsRetry = filteredExisting.filter(v => Array.isArray(v.timestamps) && v.timestamps.length === 0);
      if (needsRetry.length > 0) {
        console.log(`\n--- Retrying Vertex AI enrichment for ${needsRetry.length} existing video(s) with empty timestamps ---`);
        for (const video of needsRetry) {
          const enriched = await enrichWithVideoSummary(video);
          if (typeof enriched === 'object' && enriched !== null) {
            video.summary = enriched.summary || video.summary;
            video.timestamps = enriched.timestamps || [];
          }
        }
      }
    }

    const finalVideos = [...curatedVideos, ...filteredExisting].slice(0, 15); // Keep up to 15 in the feed

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

main();
