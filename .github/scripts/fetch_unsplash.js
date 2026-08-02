const fs = require('fs');
const path = require('path');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const USERNAME = 'frdspuzi';
const FAVOURITES_COLLECTION_ID = 'NMPJIZguCfY';
const PER_PAGE = 30; // Unsplash's max per_page
const MAX_PAGES = 20; // safety cap — 20 * 30 = 600 photos, far beyond what this profile has
const PAGE_DELAY_MS = 300;

const DATA_DIR = path.join(__dirname, '..', '..', '_data');
const META_FILE = path.join(DATA_DIR, 'unsplash_meta.json');
const ALL_FILE = path.join(DATA_DIR, 'unsplash_all.json');
const FAVOURITES_FILE = path.join(DATA_DIR, 'unsplash_favourites.json');
const PHOTOS_DIR = path.join(__dirname, '..', '..', 'assets', 'photography');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Downloads straight into the repo instead of the browser hotlinking images.unsplash.com on
// every visit — see the comment on syncLocalImages() below for why. `fm=jpg` forces a real JPEG
// response regardless of what content negotiation would otherwise pick (Unsplash's CDN can serve
// WebP/AVIF depending on Accept headers), since the file is saved with a .jpg extension and
// GitHub Pages serves Content-Type by extension — a mismatched format would be technically wrong
// even though most browsers tolerate it via content-sniffing.
async function downloadImage(url, destPath) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}fm=jpg`);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// Downloads any photo (from either source, deduped by id) not already saved locally, and removes
// any locally-saved photo that's no longer on the profile or in Favourites — the "crosscheck if
// they're still on the profile" half of this feature. Only reachable from the full-fetch path
// (the change-detection short-circuit above already skips this when nothing changed, which is
// correct: if Unsplash-side metadata is unchanged, the local files from the last successful sync
// are still accurate).
async function syncLocalImages(allPhotos, favPhotos) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });

  const currentById = new Map();
  [...allPhotos, ...favPhotos].forEach((p) => {
    if (!currentById.has(p.id)) currentById.set(p.id, p);
  });

  const existingFiles = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith('.jpg'));
  const existingIds = new Set(existingFiles.map((f) => f.slice(0, -4)));

  let downloaded = 0;
  for (const [id, photo] of currentById) {
    if (existingIds.has(id)) continue;
    await downloadImage(photo.urls.small, path.join(PHOTOS_DIR, `${id}.jpg`));
    downloaded++;
    await sleep(PAGE_DELAY_MS); // polite to Unsplash's CDN too, not just their API
  }

  let removed = 0;
  for (const file of existingFiles) {
    if (!currentById.has(file.slice(0, -4))) {
      fs.unlinkSync(path.join(PHOTOS_DIR, file));
      removed++;
    }
  }

  console.log(`Local photo sync: ${downloaded} downloaded, ${removed} removed, ${currentById.size} total.`);
}

function readPreviousMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch (err) {
    return null; // no previous run, or file unreadable — treat as "always fetch"
  }
}

// Fetches every page of a paginated Unsplash endpoint, stopping once a page comes back
// short of PER_PAGE (the standard signal that it was the last page) or MAX_PAGES is hit.
async function fetchAllPages(urlBase, headers) {
  const results = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep = urlBase.includes('?') ? '&' : '?';
    const res = await fetch(`${urlBase}${sep}per_page=${PER_PAGE}&page=${page}`, { headers });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < PER_PAGE) break; // last page
    await sleep(PAGE_DELAY_MS);
  }
  return results;
}

async function fetchUnsplash() {
  if (!UNSPLASH_ACCESS_KEY) {
    console.error('Error: UNSPLASH_ACCESS_KEY environment variable is not set.');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
    'Accept-Version': 'v1'
  };

  try {
    // Three cheap requests to check whether anything has actually changed since the last run,
    // before doing the expensive full paginated fetch. This site's photo count changes rarely
    // (uploads are occasional, not constant), and this script runs on a fixed twice-daily
    // schedule regardless — most runs would otherwise re-fetch identical data for no reason,
    // burning Unsplash's free-tier rate limit (50 req/hr) on nothing.
    //
    // total_photos alone isn't enough: it catches pure additions/deletions, but misses a
    // delete-one-then-upload-one edit, since the net count stays identical even though the
    // actual photo set changed. Also checking the single most recent photo's `id` (a 1-item
    // `order_by=latest` fetch, still cheap — not the full pagination) catches that case too: a
    // freshly reuploaded photo becomes a *different* "latest" photo even when total_photos is
    // unchanged. Together: count changing catches add/remove, latest-id changing catches
    // same-count replacement. (A metadata-only edit to an older, non-latest photo — no add/
    // remove, no new upload — is the one thing neither cheap check can catch without fetching
    // everything, which would defeat the point of checking cheaply at all; not addressed here.)
    console.log('Checking for changes...');
    const [userRes, collectionRes, latestPhotoRes] = await Promise.all([
      fetch(`https://api.unsplash.com/users/${USERNAME}`, { headers }),
      fetch(`https://api.unsplash.com/collections/${FAVOURITES_COLLECTION_ID}`, { headers }),
      fetch(`https://api.unsplash.com/users/${USERNAME}/photos?order_by=latest&per_page=1`, { headers })
    ]);
    const userData = await userRes.json();
    const collectionData = await collectionRes.json();
    const latestPhotoData = await latestPhotoRes.json();

    const currentUserTotal = userData && typeof userData.total_photos === 'number' ? userData.total_photos : null;
    const currentCollectionTotal = collectionData && typeof collectionData.total_photos === 'number' ? collectionData.total_photos : null;
    const currentLatestPhotoId = Array.isArray(latestPhotoData) && latestPhotoData[0] ? latestPhotoData[0].id : null;

    // Also guards the one-time migration to local photo storage: unsplash_meta.json already
    // existed from before that feature shipped, so on the very first run afterward, previous's
    // fields would legitimately match current (nothing changed on Unsplash's side) even though
    // assets/photography/ has never been populated yet — without this check, that first run
    // would incorrectly skip and the local files would never get downloaded at all.
    const hasLocalPhotos = fs.existsSync(PHOTOS_DIR) && fs.readdirSync(PHOTOS_DIR).some((f) => f.endsWith('.jpg'));

    const previous = readPreviousMeta();
    const unchanged =
      previous &&
      hasLocalPhotos &&
      currentUserTotal !== null &&
      currentCollectionTotal !== null &&
      currentLatestPhotoId !== null &&
      previous.userTotalPhotos === currentUserTotal &&
      previous.favouritesTotalPhotos === currentCollectionTotal &&
      previous.latestPhotoId === currentLatestPhotoId;

    if (unchanged) {
      console.log(`No changes (still ${currentUserTotal} profile photos, ${currentCollectionTotal} in Favourites, latest photo unchanged) — skipping full fetch.`);
      return;
    }

    console.log(
      previous
        ? `Change detected (profile ${previous.userTotalPhotos} -> ${currentUserTotal}, favourites ${previous.favouritesTotalPhotos} -> ${currentCollectionTotal}, latest photo ${previous.latestPhotoId} -> ${currentLatestPhotoId}). Fetching...`
        : 'No previous run found. Fetching...'
    );

    console.log('Fetching all photos from profile...');
    const allPhotos = await fetchAllPages(`https://api.unsplash.com/users/${USERNAME}/photos?order_by=latest`, headers);
    fs.writeFileSync(ALL_FILE, JSON.stringify(allPhotos, null, 2));
    console.log(`Saved ${allPhotos.length} photos to unsplash_all.json.`);

    console.log('Fetching Favourites collection...');
    const favPhotos = await fetchAllPages(`https://api.unsplash.com/collections/${FAVOURITES_COLLECTION_ID}/photos`, headers);
    fs.writeFileSync(FAVOURITES_FILE, JSON.stringify(favPhotos, null, 2));
    console.log(`Saved ${favPhotos.length} photos to unsplash_favourites.json.`);

    console.log('Syncing local photo copies...');
    await syncLocalImages(allPhotos, favPhotos);

    fs.writeFileSync(
      META_FILE,
      JSON.stringify(
        {
          userTotalPhotos: currentUserTotal,
          favouritesTotalPhotos: currentCollectionTotal,
          latestPhotoId: currentLatestPhotoId,
          lastFetched: new Date().toISOString()
        },
        null,
        2
      )
    );

    console.log('Successfully fetched and saved all Unsplash data.');
  } catch (err) {
    console.error('Script failed:', err.message);
    process.exit(1);
  }
}

fetchUnsplash();
