import { describe, it, expect } from "vitest";
import researchData from "../../../_data/research.json";
import type { ResearchData, ResearchTopic } from "./research_types";

describe("research data seed", () => {
  it("conforms to ResearchData schema", () => {
    const data = researchData as ResearchData;
    expect(data).toBeDefined();
    expect(typeof data.lastUpdated).toBe("string");
    expect(Array.isArray(data.papers)).toBe(true);

    const allowedTopics: ResearchTopic[] = [
      "Tech",
      "Islamic Studies & Finance",
      "Career & Productivity",
    ];

    for (const paper of data.papers) {
      expect(paper.id).toBeTruthy();
      expect(paper.title).toBeTruthy();
      expect(paper.publicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(paper.venue).toBeTruthy();
      expect(paper).not.toHaveProperty("summary");
      for (const field of ["problem", "fix", "practicalUseCase", "limitation"] as const) {
        expect(paper[field]).toBeTruthy();
        expect(paper[field]).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      expect(paper.fullTextUrl).toMatch(/^https?:\/\//);
      expect(paper.topics.length).toBeGreaterThan(0);
      for (const topic of paper.topics) {
        expect(allowedTopics).toContain(topic);
      }
    }
  });
});
