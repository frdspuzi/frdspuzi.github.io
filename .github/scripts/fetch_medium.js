const fs = require('fs');
const path = require('path');

const USERNAME = 'frdspuzi';
const MEDIUM_RSS = `https://medium.com/feed/@${USERNAME}`;
const API_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(MEDIUM_RSS);

const DATA_DIR = path.join(__dirname, '..', '..', '_data');
const MEDIUM_FILE = path.join(DATA_DIR, 'medium.json');
const IMAGES_DIR = path.join(__dirname, '..', '..', 'assets', 'medium-images');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same extraction as thoughts.html's/MediumTray.tsx's own findImageUrl() - first <img> in the
// article body that isn't a stat?event tracking pixel.
function findImageUrl(content) {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1].indexOf('stat?event') === -1) return match[1];
  }
  return null;
}

// Requests a real JPEG, not the frontend's own WebP - that version rewrites the URL for a
// visitor's browser to hotlink Medium's CDN directly; this one is for a file this script itself
// downloads and saves with a .jpg extension, and GitHub Pages serves Content-Type by extension
// (same reasoning fetch_unsplash.js's own fm=jpg already documents).
function shrinkForDownload(url, targetWidth) {
  return url
    .replace(/resize:fit:\d+(\/format:\w+)?/, 'resize:fit:' + targetWidth + '/format:jpeg')
    .replace(/\/max\/\d+\//, '/v2/resize:fit:' + targetWidth + '/format:jpeg/');
}

// guid is a URL like https://medium.com/p/82aba770b097 - the trailing segment is a stable,
// filename-safe id, same pattern as YouTube's own videoId-keyed thumbnails.
function guidToId(guid) {
  return guid.split('/').filter(Boolean).pop();
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// Self-hosted, not hotlinked from cdn-images-1.medium.com: that CDN sets a third-party cookie
// (_cfuvid) and no meaningful cache-control headers, both real Lighthouse findings, the same
// issue self-hosting YouTube thumbnails already fixed for i.ytimg.com. Downloaded at 320px (the
// desktop row-card's own target width) - the mobile story-tray's 240px context just scales the
// same file down via CSS rather than maintaining two saved variants, since these are already
// small thumbnail-sized images either way.
async function syncImages(items) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const currentIds = new Set();
  for (const item of items) {
    const rawUrl = findImageUrl(item.content);
    if (!rawUrl) continue; // no image in this article - nothing to self-host
    const id = guidToId(item.guid);
    currentIds.add(id);
    const dest = path.join(IMAGES_DIR, `${id}.jpg`);
    if (fs.existsSync(dest)) continue;
    try {
      await downloadImage(shrinkForDownload(rawUrl, 320), dest);
      console.log(`Downloaded Medium image for ${id}`);
    } catch (err) {
      console.error(`Medium image download failed for ${id}, will retry next run:`, err.message);
    }
    await sleep(300);
  }

  const existingFiles = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.jpg'));
  let removed = 0;
  for (const file of existingFiles) {
    if (!currentIds.has(file.slice(0, -4))) {
      fs.unlinkSync(path.join(IMAGES_DIR, file));
      removed++;
    }
  }
  console.log(`Medium image sync: removed ${removed} stale, ${currentIds.size} total.`);
}

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
    await syncImages(items);
    fs.writeFileSync(MEDIUM_FILE, JSON.stringify(items, null, 2));
    console.log(`Saved ${items.length} articles to medium.json.`);
  } catch (err) {
    console.error('Script failed:', err.message);
    process.exit(1);
  }
}

fetchMedium();
