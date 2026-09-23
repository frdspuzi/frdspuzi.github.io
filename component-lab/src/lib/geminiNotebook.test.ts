import { describe, expect, it } from "vitest";
import { buildGeminiNotebookClipboard, buildGeminiNotebookPrompt, pasteKey } from "./geminiNotebook";

const video = {
  title: "Cukai Malaysia vs Singapore",
  channel: "Financial Faiz",
  category: "Finance",
  url: "https://www.youtube.com/watch?v=QFxzKnP3VuE",
};

describe("buildGeminiNotebookPrompt", () => {
  it("names the video and channel, then asks for a plain-language takeaways/apply/follow-ups breakdown", () => {
    expect(buildGeminiNotebookPrompt(video)).toBe(
      'Video: "Cukai Malaysia vs Singapore" by Financial Faiz. Explain it in plain, simple terms:\n' +
        "1. The key takeaways, as short bullet points.\n" +
        "2. One or two practical ways I could apply this.\n" +
        "3. Three follow-up questions worth asking about it.",
    );
  });

  it("for Islamic Studies, asks for Quran/hadith references cited inline in the points, not in a separate section", () => {
    const prompt = buildGeminiNotebookPrompt({ ...video, category: "Islamic Studies" });
    expect(prompt).toBe(
      buildGeminiNotebookPrompt(video) +
        "\nWherever a point draws on a Quran verse or hadith, cite it inside that same point, not in a " +
        "separate section: the Arabic text, an English translation (Saheeh International for the Quran, the " +
        "translation shown on sunnah.com for hadith), its exact number and a link, Quran as surah:ayah " +
        "(e.g. https://quran.com/2/255) and hadith by collection and number (e.g. https://sunnah.com/bukhari:1), " +
        "noting whether each hadith is sahih. If you can't confirm a reference or its wording, say so instead " +
        "of guessing.",
    );
  });
});

describe("buildGeminiNotebookClipboard", () => {
  it("puts the video link first, then the prompt, so a single paste carries both", () => {
    expect(buildGeminiNotebookClipboard(video)).toBe(
      "https://www.youtube.com/watch?v=QFxzKnP3VuE\n\n" + buildGeminiNotebookPrompt(video),
    );
  });
});

describe("pasteKey", () => {
  it("has no shortcut on touchscreens, whatever the platform string says", () => {
    expect(pasteKey("Linux armv8l", true)).toBeNull();
    expect(pasteKey("iPhone", true)).toBeNull();
  });

  it("uses ⌘V on Apple keyboards", () => {
    expect(pasteKey("MacIntel", false)).toBe("⌘V");
  });

  it("uses Ctrl+V on other keyboards", () => {
    expect(pasteKey("Win32", false)).toBe("Ctrl+V");
    expect(pasteKey("Linux x86_64", false)).toBe("Ctrl+V");
    expect(pasteKey("", false)).toBe("Ctrl+V");
  });
});
