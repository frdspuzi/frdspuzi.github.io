const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MEDIUM_RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@frdspuzi';
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'learning.json');

async function generateLearning() {
  if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  try {
    console.log("Fetching latest articles from Medium...");
    const rssRes = await fetch(MEDIUM_RSS_URL);
    const rssData = await rssRes.json();
    
    if (rssData.status !== 'ok' || !rssData.items || rssData.items.length === 0) {
      throw new Error("Failed to fetch articles or no articles found.");
    }

    // Pick a random article
    const randomArticle = rssData.items[Math.floor(Math.random() * rssData.items.length)];
    console.log(`Selected article: ${randomArticle.title}`);

    // Basic HTML stripping to save tokens (Gemini can handle HTML, but this is cleaner)
    const cleanContent = randomArticle.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    console.log("Asking Gemini to extract a learning...");
    const prompt = `You are an expert editor. Read the following text from an article and extract the single most valuable, inspiring, and punchy key learning from it. Make it exactly one sentence long. Do not use quotes around it. Make it sound profound but conversational. \n\nText:\n${cleanContent.substring(0, 15000)}`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        }
      })
    });

    const geminiData = await geminiRes.json();
    
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error(JSON.stringify(geminiData, null, 2));
      throw new Error("Gemini API did not return a candidate.");
    }

    const learningText = geminiData.candidates[0].content.parts[0].text.trim();
    console.log(`Extracted Learning: ${learningText}`);

    const finalOutput = {
      learning: learningText,
      articleTitle: randomArticle.title,
      articleUrl: randomArticle.link,
      fetchedAt: new Date().toISOString()
    };

    // Ensure _data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2));
    console.log(`Successfully wrote learning to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error("Script failed:", err.message);
    process.exit(1);
  }
}

generateLearning();
