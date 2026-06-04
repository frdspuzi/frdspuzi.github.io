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

    // Pick up to 5 random articles
    const shuffledItems = rssData.items.sort(() => 0.5 - Math.random());
    const selectedArticles = shuffledItems.slice(0, 5);
    console.log(`Selected ${selectedArticles.length} articles.`);

    const generatedLearnings = [];

    // Helper to sleep and avoid hitting rate limits too quickly
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const article of selectedArticles) {
      try {
        console.log(`Asking Gemini to extract a learning for: ${article.title}`);

        // Basic HTML stripping
        const cleanContent = article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        const prompt = `You are an expert technical writer and quiz master. Read the following article and extract a single "nugget of knowledge" from it. Then, generate a multiple-choice trivia question based on that insight.

Rules:
1. The "learning" must be a highly valuable, standalone fact, concept, or insight from the text (1-2 sentences).
2. The "question" must test the user on that exact learning.
3. CRITICAL: The "question" must be phrased as general standalone trivia. DO NOT use phrases like "According to the text", "Based on the article", or "As mentioned".
4. Provide the exact correct answer as a string in "correctOption".
5. Provide 3 plausible but incorrect answers as an array of strings in "incorrectOptions".
6. CRITICAL: Only refer to the provided body text. Do not add outside knowledge.

Output a strictly valid JSON object matching this schema:
{
  "question": "The question string",
  "correctOption": "The correct answer",
  "incorrectOptions": ["Wrong A", "Wrong B", "Wrong C"],
  "learning": "The extracted insight string"
}

Article Title: ${article.title}

Text:
${cleanContent.substring(0, 15000)}`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
              maxOutputTokens: 8192
            }
          })
        });

        const geminiData = await geminiRes.json();

        if (!geminiData.candidates || geminiData.candidates.length === 0) {
          console.error("Gemini API Error for", article.title, ":", JSON.stringify(geminiData, null, 2));
          continue;
        }

        let learningText = geminiData.candidates[0].content.parts[0].text.trim();
        // Extract strictly the JSON object to ignore conversational filler or markdown
        let jsonMatch = learningText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          learningText = jsonMatch[0];
        }
        
        let parsedData;
        try {
          parsedData = JSON.parse(learningText);
        } catch (e) {
          console.error("Failed to parse Gemini JSON output for", article.title, ":", learningText);
          continue;
        }

        console.log(`Extracted Question: ${parsedData.question}`);

        // Manually shuffle the options to guarantee true randomness
        let allOptions = [parsedData.correctOption, ...(parsedData.incorrectOptions || [])];
        
        // Fisher-Yates shuffle
        for (let i = allOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
        }

        const actualCorrectIndex = allOptions.indexOf(parsedData.correctOption);

        generatedLearnings.push({
          question: parsedData.question,
          options: allOptions,
          correctIndex: actualCorrectIndex,
          learning: parsedData.learning,
          articleTitle: article.title,
          articleUrl: article.link
        });

        // Delay 2 seconds between requests
        await sleep(2000);
      } catch (err) {
        console.error("Error processing article", article.title, err.message);
      }
    }

    if (generatedLearnings.length === 0) {
      throw new Error("Failed to generate any learnings.");
    }

    const finalOutput = {
      learnings: generatedLearnings,
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
