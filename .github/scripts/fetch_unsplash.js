const fs = require('fs');
const path = require('path');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const USERNAME = 'frdspuzi';
const FAVOURITES_COLLECTION_ID = 'NMPJIZguCfY';

async function fetchUnsplash() {
  if (!UNSPLASH_ACCESS_KEY) {
    console.error("Error: UNSPLASH_ACCESS_KEY environment variable is not set.");
    process.exit(1);
  }

  const headers = {
    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
    'Accept-Version': 'v1'
  };

  try {
    console.log("Fetching Latest photos...");
    const latestRes = await fetch(`https://api.unsplash.com/users/${USERNAME}/photos?per_page=12&order_by=latest`, { headers });
    const latestData = await latestRes.json();
    fs.writeFileSync(path.join(__dirname, '..', '..', '_data', 'unsplash_latest.json'), JSON.stringify(latestData, null, 2));

    console.log("Fetching Favourites collection...");
    const favRes = await fetch(`https://api.unsplash.com/collections/${FAVOURITES_COLLECTION_ID}/photos?per_page=12`, { headers });
    const favData = await favRes.json();
    fs.writeFileSync(path.join(__dirname, '..', '..', '_data', 'unsplash_favourites.json'), JSON.stringify(favData, null, 2));

    console.log("Fetching Popular photos...");
    const popularRes = await fetch(`https://api.unsplash.com/users/${USERNAME}/photos?per_page=5&order_by=popular`, { headers });
    const popularData = await popularRes.json();

    if (Array.isArray(popularData)) {
      console.log("Fetching view statistics for popular photos...");
      for (let photo of popularData) {
        try {
          // Delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const statsRes = await fetch(`https://api.unsplash.com/photos/${photo.id}/statistics`, { headers });
          const statsData = await statsRes.json();
          
          if (statsData && statsData.views && statsData.views.total) {
            photo.views = statsData.views.total;
          } else {
            photo.views = 0; // fallback
          }
          console.log(`- Photo ${photo.id} has ${photo.views} views.`);
        } catch (err) {
          console.error(`Failed to fetch stats for ${photo.id}:`, err.message);
          photo.views = 0;
        }
      }
    }

    fs.writeFileSync(path.join(__dirname, '..', '..', '_data', 'unsplash_popular.json'), JSON.stringify(popularData, null, 2));
    console.log("Successfully fetched and saved all Unsplash data.");
  } catch (err) {
    console.error("Script failed:", err.message);
    process.exit(1);
  }
}

fetchUnsplash();
