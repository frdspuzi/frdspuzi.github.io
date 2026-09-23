import { toSentenceCase } from "@/lib/utils";
import type { YoutubeVideo } from "@/data/youtube_types";

type NotebookVideo = Pick<YoutubeVideo, "title" | "category" | "url">;

export const GEMINI_NOTEBOOK_NEW_URL = "https://notebook.google.com/new";

export function buildGeminiNotebookPrompt(video: NotebookVideo): string {
  return (
    `Summarize the key points from this video ("${video.title}"), and give me a few discussion ` +
    `questions or ways to apply ${toSentenceCase(video.category)} advice like this.`
  );
}

export function buildGeminiNotebookClipboard(video: NotebookVideo): string {
  return video.url + "\n\n" + buildGeminiNotebookPrompt(video);
}

// Touch is checked first: Android reports a "Linux ..." platform, which would otherwise read as a
// keyboard OS and get a Ctrl+V instruction it can't follow.
export function pasteInstruction(platform: string, coarsePointer: boolean): string {
  if (coarsePointer) return "long-press and tap Paste";
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "press ⌘V" : "press Ctrl+V";
}
