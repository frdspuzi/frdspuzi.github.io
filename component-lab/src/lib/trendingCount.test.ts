import { describe, expect, it } from "vitest";
import { matchedTrendingCount } from "./trendingCount";

describe("matchedTrendingCount", () => {
  it("returns the smaller of the two counts when both are non-zero", () => {
    expect(matchedTrendingCount(18, 10)).toBe(10);
    expect(matchedTrendingCount(3, 20)).toBe(3);
  });

  it("falls back to the larger count when one source is empty", () => {
    // Product Hunt data not fetched yet shouldn't hide a perfectly good GitHub list.
    expect(matchedTrendingCount(18, 0)).toBe(18);
    expect(matchedTrendingCount(0, 12)).toBe(12);
  });

  it("returns 0 when both sources are empty", () => {
    expect(matchedTrendingCount(0, 0)).toBe(0);
  });

  it("returns the shared count when both sources are equal", () => {
    expect(matchedTrendingCount(7, 7)).toBe(7);
  });
});
