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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // Two cheap requests (single-object responses, not paginated photo lists) to check whether
    // anything has actually changed since the last run, before doing the expensive full fetch.
    // This site's photo count changes rarely (uploads are occasional, not constant), and this
    // script runs on a fixed twice-daily schedule regardless — most runs would otherwise re-fetch
    // identical data for no reason, burning Unsplash's free-tier rate limit (50 req/hr) on
    // nothing. `total_photos` is Unsplash's own documented field on both the user and collection
    // objects, updated whenever a photo is added or removed.
    console.log('Checking for changes...');
    const [userRes, collectionRes] = await Promise.all([
      fetch(`https://api.unsplash.com/users/${USERNAME}`, { headers }),
      fetch(`https://api.unsplash.com/collections/${FAVOURITES_COLLECTION_ID}`, { headers })
    ]);
    const userData = await userRes.json();
    const collectionData = await collectionRes.json();

    const currentUserTotal = userData && typeof userData.total_photos === 'number' ? userData.total_photos : null;
    const currentCollectionTotal = collectionData && typeof collectionData.total_photos === 'number' ? collectionData.total_photos : null;

    const previous = readPreviousMeta();
    const unchanged =
      previous &&
      currentUserTotal !== null &&
      currentCollectionTotal !== null &&
      previous.userTotalPhotos === currentUserTotal &&
      previous.favouritesTotalPhotos === currentCollectionTotal;

    if (unchanged) {
      console.log(`No changes (still ${currentUserTotal} profile photos, ${currentCollectionTotal} in Favourites) — skipping full fetch.`);
      return;
    }

    console.log(
      previous
        ? `Change detected (profile ${previous.userTotalPhotos} -> ${currentUserTotal}, favourites ${previous.favouritesTotalPhotos} -> ${currentCollectionTotal}). Fetching...`
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

    fs.writeFileSync(
      META_FILE,
      JSON.stringify(
        {
          userTotalPhotos: currentUserTotal,
          favouritesTotalPhotos: currentCollectionTotal,
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
