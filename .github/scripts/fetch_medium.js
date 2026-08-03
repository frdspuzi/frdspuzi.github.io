const fs = require('fs');
const path = require('path');

const USERNAME = 'frdspuzi';
const MEDIUM_RSS = `https://medium.com/feed/@${USERNAME}`;
const API_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(MEDIUM_RSS);

const DATA_DIR = path.join(__dirname, '..', '..', '_data');
const MEDIUM_FILE = path.join(DATA_DIR, 'medium.json');

// Previously fetched live in the browser on every single page view (thoughts.html), which put
// rss2json's own response time (834ms observed via PageSpeed Insights' network dependency chain)
// directly in every visitor's critical path. Fetched here at build time instead, same pattern as
// fetch_youtube.js/generate_gratitude.js/generate_learning.js — a visitor's browser now just
// reads the already-fetched _data/medium.json, no live third-party call at all.
async function fetchMedium() {
  try {
    console.log('Fetching Medium RSS feed via rss2json...');
    const res = await fetch(API_URL);
    if (!res.ok) {
      throw new Error(`rss2json responded with HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      throw new Error(`Unexpected rss2json response shape: ${JSON.stringify(data).slice(0, 200)}`);
    }

    // Same 10-item cap thoughts.html already applied client-side — no reason to store more than
    // the page will ever render.
    const items = data.items.slice(0, 10);
    fs.writeFileSync(MEDIUM_FILE, JSON.stringify(items, null, 2));
    console.log(`Saved ${items.length} articles to medium.json.`);
  } catch (err) {
    console.error('Script failed:', err.message);
    process.exit(1);
  }
}

fetchMedium();
