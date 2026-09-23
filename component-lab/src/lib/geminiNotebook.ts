import type { YoutubeVideo } from "@/data/youtube_types";

type NotebookVideo = Pick<YoutubeVideo, "title" | "channel" | "category" | "url">;

export const GEMINI_NOTEBOOK_NEW_URL = "https://notebook.google.com/new";

// Tested live in Gemini Notebook: pasted with the link into an empty notebook's chat, Gemini adds
// the video as a source itself and answers. No "answer in English" line needed - a Malay video
// still got an English answer from this English prompt. No timestamps asked for: only the
// transcript is imported, so they could be invented; the notebook's own citations cover that.
//
// Islamic Studies videos also ask for each Quran/hadith reference with its exact number and a
// link, cited inside the point it supports: a numbered "4." item made Gemini put them all in a
// separate section at the end (tested), away from the claims they back. The example URLs show the formats (both verified to resolve: Ayatul Kursi, Sahih
// al-Bukhari 1). "Say so instead of guessing": a wrong hadith number or grading is worse than none.
export function buildGeminiNotebookPrompt(video: NotebookVideo): string {
  const prompt =
    `Video: "${video.title}" by ${video.channel}. Explain it in plain, simple terms:\n` +
    "1. The key takeaways, as short bullet points.\n" +
    "2. One or two practical ways I could apply this.\n" +
    "3. Three follow-up questions worth asking about it.";
  if (video.category !== "Islamic Studies") return prompt;
  return (
    prompt +
    "\nWherever a point draws on a Quran verse or hadith, cite it inside that same point, not in a " +
    "separate section: the Arabic text, an English translation (Saheeh International for the Quran, the " +
    "translation shown on sunnah.com for hadith), its exact number and a link, Quran as surah:ayah " +
    "(e.g. https://quran.com/2/255) and hadith by collection and number (e.g. https://sunnah.com/bukhari:1), " +
    "noting whether each hadith is sahih. If you can't confirm a reference or its wording, say so instead " +
    "of guessing."
  );
}

export function buildGeminiNotebookClipboard(video: NotebookVideo): string {
  return video.url + "\n\n" + buildGeminiNotebookPrompt(video);
}

// Touch is checked first: Android reports a "Linux ..." platform, which would otherwise read as a
// keyboard OS and get a Ctrl+V shortcut it can't use. null = no keyboard shortcut (long-press).
export function pasteKey(platform: string, coarsePointer: boolean): string | null {
  if (coarsePointer) return null;
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "⌘V" : "Ctrl+V";
}
