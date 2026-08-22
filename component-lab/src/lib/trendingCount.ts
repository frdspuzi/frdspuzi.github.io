// Desktop count for TrendingSection's two carousels: match to whichever source has fewer items,
// so neither carousel runs noticeably deeper than the other (per the 2026-08-22 grilling
// decision - "match the one that has less"). Falls back to the non-zero side when one source is
// empty (e.g. Product Hunt data hasn't been fetched yet) - matching to 0 would hide a perfectly
// good GitHub list just because the other source has nothing yet, which isn't what "match" was
// ever meant to do.
export function matchedTrendingCount(repoCount: number, postCount: number): number {
  return Math.min(repoCount, postCount) || Math.max(repoCount, postCount);
}
