import { describe, expect, it } from "vitest";
import { parseBook, publishable } from "./books";

const raw = `---
title: The Unfair Advantage
author: Ash Ali & Hasan Kubba
color: #f6d31f
cover: tua.jpg
status: reading
reachedPage: 52
---

My take.

## Ch. 1 — Life is unfair

### pp. 13–14

First insight.

### pp. 16–18

TODO

## Ch. 2 — Journeys

### pp. 20–21

Second insight.
`;

describe("parseBook", () => {
  it("reads front matter, take, and insights under their chapters", () => {
    const book = parseBook("tua", raw.replace(/\n/g, "\r\n")); // Windows checkouts
    expect(book).toMatchObject({
      title: "The Unfair Advantage",
      color: "#f6d31f",
      status: "reading",
      reachedPage: 52,
      take: "My take.",
    });
    expect(book.insights.map((i) => [i.chapter, i.pages, i.body])).toEqual([
      ["Ch. 1 — Life is unfair", "pp. 13–14", "First insight."],
      ["Ch. 1 — Life is unfair", "pp. 16–18", "TODO"],
      ["Ch. 2 — Journeys", "pp. 20–21", "Second insight."],
    ]);
  });

  it("rejects a file missing required front matter", () => {
    expect(() => parseBook("x", "---\ntitle: X\n---\nbody")).toThrow(/author/);
  });
});

describe("publishable", () => {
  const book = parseBook("tua", raw);

  it("drops unwritten insights in production", () => {
    expect(publishable(book, false)?.insights.map((i) => i.pages)).toEqual(["pp. 13–14", "pp. 20–21"]);
  });

  it("keeps drafts in dev", () => {
    expect(publishable(book, true)?.insights).toHaveLength(3);
  });

  it("hides a book with an unwritten take or no written insights", () => {
    expect(publishable({ ...book, take: "TODO: write" }, false)).toBeNull();
    expect(publishable({ ...book, take: "" }, true)).toBeNull();
    expect(publishable({ ...book, insights: book.insights.slice(1, 2) }, false)).toBeNull();
  });
});
