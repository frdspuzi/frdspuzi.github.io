const fs = require('fs');
const path = require('path');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'youtube.json');

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHANNELS = [
  { url: "https://www.youtube.com/@aiDotEngineer", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/@RyanLPeterman", category: "Tech & Career" },
  { url: "https://www.youtube.com/@aliabdaal", category: "Productivity" },
  { url: "https://www.youtube.com/@GoogleDevelopers", category: "Tech & Engineering" },
  { url: "https://www.youtube.com/channel/UCSYUI0C0gG-Kp03GBaO2G9Q", category: "Finance & Malaysia" },
  { url: "https://www.youtube.com/channel/UCYkfgq8LmajU50WadNGGxtA", category: "Finance & Malaysia" },
  { url: "https://www.youtube.com/@TheGameOfImpossible", category: "Productivity" },
  { url: "https://www.youtube.com/@bfmradiomy", category: "Finance & Malaysia" },
  { url: "https://www.youtube.com/@TEDx", category: "General Ideas" },
  { url: "https://www.youtube.com/@yaqeeninstituteofficial", category: "Islamic Studies" },
  { url: "https://www.youtube.com/@shabdullahoduro", category: "Islamic Studies" }
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
    const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
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
              title: item.videoRenderer.title.runs[0].text,
              link: `https://www.youtube.com/watch?v=${item.videoRenderer.videoId}`,
              thumbnail: item.videoRenderer.thumbnail.thumbnails[0].url,
              author: item.videoRenderer.ownerText?.runs[0]?.text || "YouTube Creator"
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
              generationConfig: { temperature: 1.1, maxOutputTokens: 1024 }
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
2. Select EXACTLY the top 5 most genuinely valuable videos from the entire list.
3. For each selected video, write a layman-friendly summary (2-3 sentences) explaining WHY it's worth their time. Make it intriguing and hook the viewer, but keep the tone natural and authentic—do not sound like an over-the-top marketer.
4. Return ONLY valid JSON in the exact format below, with nothing else:
{
  "selected_videos": [
    {
      "videoId": "the_videoId_here",
      "summary": "Your detailed hook summary here."
    }
  ]
}`;

  const responseText = await callGemini(prompt);
  if (!responseText) return [];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.selected_videos || [];
    }
  } catch (err) {
    console.error("Failed to parse Gemini response", responseText);
  }
  return [];
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
      let cleanDesc = (vid.description || "").replace(/<[^>]*>?/gm, '').substring(0, 400).trim();

      videoCandidates.push({
        videoId: videoId,
        title: vid.title,
        channel: vid.author || channel.category,
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

  const selectedVideos = await evaluateBulk(videoCandidates);
  const curatedVideos = [];

  for (const selected of selectedVideos) {
    // Match the selected ID back to our original candidate list
    const candidate = videoCandidates.find(v => v.videoId === selected.videoId);
    if (candidate) {
      curatedVideos.push({
        title: candidate.title,
        url: candidate.url,
        videoId: candidate.videoId,
        channel: candidate.channel,
        category: candidate.category,
        summary: selected.summary,
        dateAdded: new Date().toISOString()
      });
      console.log(`Added Winner: ${candidate.title}`);
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
      } catch (e) {}
    }

    const newVideoIds = new Set(curatedVideos.map(v => v.videoId));
    const filteredExisting = existingVideos.filter(v => !newVideoIds.has(v.videoId));
    
    const finalVideos = [...curatedVideos, ...filteredExisting].slice(0, 15); // Keep up to 15 in the feed

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
    console.log("Gemini did not return any valid selections today.");
  }
}

main();
