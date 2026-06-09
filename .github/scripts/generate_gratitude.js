const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'gratitude.json');
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let currentModelIndex = 0;

async function callGemini(prompt) {
  while (currentModelIndex < GEMINI_MODELS.length) {
    const model = GEMINI_MODELS[currentModelIndex];
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
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
        console.error(`Gemini API Error (HTTP ${res.status}) on ${model}:`, JSON.stringify(data, null, 2));
        currentModelIndex++;
        break; 
      }

      return data;
    }
  }
  
  console.error(`All Gemini models failed.`);
  return null;
}

async function generateGratitude() {
  if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  try {
    console.log("Asking Gemini to generate fresh gratitude suggestions...");

    const prompt = `You are a thoughtful AI assistant helping to generate daily gratitude prompts. 
Generate 15 unique, relatable gratitude suggestions. 
The demographic is a mid-20s Malaysian software engineer, likely Muslim. 
CRITICAL RULE: DO NOT explicitly state the demographic. Instead, subtly weave it into the context of the suggestions (e.g. mention things like a smooth production deployment, fixing tricky bugs, enjoying a good cup of teh tarik, morning rain, peace before Fajr, the rezeki of a stable job, or time with family).
CRITICAL RULE: The suggestions should feel personal, starting with "I'm grateful for..." or "I'm thankful for...".

Output a strictly valid JSON array of strings. Do NOT wrap it in an object, just output the array directly. Example:
[
  "I'm grateful for a smooth deployment today.",
  "I'm thankful for the quiet time before Fajr to center myself."
]
`;

    const geminiData = await callGemini(prompt);
    if (!geminiData) {
      throw new Error("Gemini returned no valid response.");
    }

    let responseText = geminiData.candidates[0].content.parts[0].text.trim();
    
    // Extract strictly the JSON array to ignore conversational filler or markdown
    let jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    let suggestions;
    try {
      suggestions = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse Gemini JSON output:", responseText);
      throw e;
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("Parsed JSON is not a valid array or is empty.");
    }

    console.log(`Generated ${suggestions.length} suggestions.`);

    const finalOutput = {
      suggestions: suggestions,
      fetchedAt: new Date().toISOString()
    };

    // Ensure _data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2));
    console.log(`Successfully wrote gratitude suggestions to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error("Script failed:", err.message);
    process.exit(1);
  }
}

generateGratitude();
