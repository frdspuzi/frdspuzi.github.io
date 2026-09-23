import { describe, expect, it } from "vitest";
import { buildGeminiNotebookClipboard, buildGeminiNotebookPrompt, pasteKey } from "./geminiNotebook";

const video = {
  title: "Cukai Malaysia vs Singapore",
  channel: "Financial Faiz",
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
