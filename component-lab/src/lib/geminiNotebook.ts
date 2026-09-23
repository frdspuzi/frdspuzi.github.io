import type { YoutubeVideo } from "@/data/youtube_types";

type NotebookVideo = Pick<YoutubeVideo, "title" | "channel" | "url">;

export const GEMINI_NOTEBOOK_NEW_URL = "https://notebook.google.com/new";

// Tested live in Gemini Notebook: pasted with the link into an empty notebook's chat, Gemini adds
// the video as a source itself and answers. No "answer in English" line needed - a Malay video
// still got an English answer from this English prompt. No timestamps asked for: only the
// transcript is imported, so they could be invented; the notebook's own citations cover that.
export function buildGeminiNotebookPrompt(video: NotebookVideo): string {
  return (
    `Video: "${video.title}" by ${video.channel}. Explain it in plain, simple terms:\n` +
    "1. The key takeaways, as short bullet points.\n" +
    "2. One or two practical ways I could apply this.\n" +
    "3. Three follow-up questions worth asking about it."
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
