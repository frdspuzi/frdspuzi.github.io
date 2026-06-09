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
async function callGemini(prompt) {
  for (const model of GEMINI_MODELS) {
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
          const waitMs = Math.pow(2, attempt) * 5000;
          console.warn(`API Error (${res.status}) on ${model}. Attempt ${attempt}. Retrying...`);
          if (attempt === MAX_RETRIES) break;
          await sleep(waitMs);
          continue;
        }

        if (!res.ok || !data.candidates || data.candidates.length === 0) {
          break; // Hard error
        }
        return data.candidates[0].content.parts[0].text.trim();
      } catch (err) {
        console.error(`Fetch error on ${model}: ${err.message}`);
        break;
      }
    }
  }
  return null;
}

// Evaluate Video via Gemini
async function evaluateVideo(video, category) {
  const prompt = `You are an expert content curator acting as a filter against algorithm bloat.
Evaluate the following YouTube video to see if it is highly valuable for self-improvement for one of these demographics:
- A Muslim
- A Malaysian
- A Junior Fullstack Software Engineer
- Someone early in their career seeking advice
- An Islamic financial advocate

Video Title: "${video.title}"
Channel: ${video.author}
Category: ${category}

CRITICAL:
1. Does this video seem genuinely valuable for self-improvement or professional/spiritual growth for the target demographic? (Yes/No)
2. If No, just output exactly: {"valuable": false}
3. If Yes, generate a detailed but layman-friendly summary (2-3 sentences) explaining *why* it's worth their time and how they can improve from it. Write it to hook the viewer!

Output STRICTLY valid JSON:
{
  "valuable": true,
  "summary": "Your detailed self-improvement summary here."
}`;

  const responseText = await callGemini(prompt);
  if (!responseText) return null;

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("Failed to parse Gemini response", responseText);
  }
  return null;
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const curatedVideos = [];
  const MAX_VIDEOS = 10;

  // 1. Roll for Discovery (20% chance)
  const roll = Math.random();
  if (roll < 0.20) {
    console.log("Discovery feature triggered!");
    const query = DISCOVERY_QUERIES[Math.floor(Math.random() * DISCOVERY_QUERIES.length)];
    console.log(`Searching YouTube for: ${query}`);
    const discoveryVids = await scrapeDiscoveryVideos(query);
    
    // Evaluate top 3 discovery videos until we find a good one
    for (const vid of discoveryVids.slice(0, 3)) {
      console.log(`Evaluating Discovery video: ${vid.title}`);
      const evalResult = await evaluateVideo(vid, "Discovery");
      if (evalResult && evalResult.valuable) {
        curatedVideos.push({
          title: vid.title,
          url: vid.link,
          thumbnail: vid.link.replace("watch?v=", "embed/").split("&")[0], // Just keeping standard videoId
          videoId: vid.link.split('v=')[1].split('&')[0],
          channel: vid.author,
          category: "Discovery 🌍",
          summary: evalResult.summary,
          dateAdded: new Date().toISOString()
        });
        console.log(`Added Discovery Video: ${vid.title}`);
        break; // Only take one discovery video
      }
      await sleep(5000);
    }
  }

  // 2. Fetch from Explicit Channels
  console.log("Fetching from explicit channels...");
  // Shuffle channels to get variety daily
  const shuffledChannels = CHANNELS.sort(() => 0.5 - Math.random()).slice(0, 5); // Pick 5 random channels to check

  for (const channel of shuffledChannels) {
    if (curatedVideos.length >= MAX_VIDEOS) break;

    const channelId = await resolveChannelId(channel.url);
    if (!channelId) continue;

    const videos = await fetchRss(channelId);
    if (videos.length === 0) continue;

    // Evaluate the most recent video
    const vid = videos[0];
    console.log(`Evaluating: ${vid.title} from ${channel.url}`);
    
    const evalResult = await evaluateVideo({
      title: vid.title,
      author: vid.author || channel.category // fallback
    }, channel.category);

    if (evalResult && evalResult.valuable) {
      const videoIdMatch = vid.link.match(/v=([a-zA-Z0-9_-]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : vid.link.split('/').pop();
      
      curatedVideos.push({
        title: vid.title,
        url: vid.link,
        videoId: videoId,
        channel: vid.author || "YouTube Creator",
        category: channel.category,
        summary: evalResult.summary,
        dateAdded: new Date().toISOString()
      });
      console.log(`Added: ${vid.title}`);
    }
    await sleep(5000); // Rate limit
  }

  // Save to _data/youtube.json
  if (curatedVideos.length > 0) {
    // Merge with existing so we don't lose old curated videos if today's batch is small
    let existingVideos = [];
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const raw = fs.readFileSync(OUTPUT_FILE);
        const data = JSON.parse(raw);
        existingVideos = data.videos || [];
      } catch (e) {}
    }

    // Prepend new videos, ensuring uniqueness by videoId
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
    console.log("No valuable videos found today.");
  }
}

main();
