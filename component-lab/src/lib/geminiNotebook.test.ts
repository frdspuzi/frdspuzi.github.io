import { describe, expect, it } from "vitest";
import { buildGeminiNotebookClipboard, buildGeminiNotebookPrompt, pasteInstruction } from "./geminiNotebook";

const video = {
  title: "Why you should read technical papers",
  category: "TECH & ENGINEERING",
  url: "https://www.youtube.com/watch?v=3CyW24Pkz4o",
};

describe("buildGeminiNotebookPrompt", () => {
  it("names the video and its category, sentence-cased as on the card", () => {
    expect(buildGeminiNotebookPrompt(video)).toBe(
      'Summarize the key points from this video ("Why you should read technical papers"), and give me a ' +
        "few discussion questions or ways to apply Tech & engineering advice like this.",
    );
  });
});

describe("buildGeminiNotebookClipboard", () => {
  it("puts the video link first, then the prompt, so a single paste carries both", () => {
    expect(buildGeminiNotebookClipboard(video)).toBe(
      "https://www.youtube.com/watch?v=3CyW24Pkz4o\n\n" + buildGeminiNotebookPrompt(video),
    );
  });
});

describe("pasteInstruction", () => {
  it("tells touchscreen users to long-press, whatever the platform string says", () => {
    expect(pasteInstruction("Linux armv8l", true)).toBe("long-press and tap Paste");
    expect(pasteInstruction("iPhone", true)).toBe("long-press and tap Paste");
  });

  it("uses ⌘V on Apple keyboards", () => {
    expect(pasteInstruction("MacIntel", false)).toBe("press ⌘V");
  });

  it("uses Ctrl+V on other keyboards", () => {
    expect(pasteInstruction("Win32", false)).toBe("press Ctrl+V");
    expect(pasteInstruction("Linux x86_64", false)).toBe("press Ctrl+V");
    expect(pasteInstruction("", false)).toBe("press Ctrl+V");
  });
});
