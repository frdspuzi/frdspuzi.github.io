export type TrendingRepo = {
  fullName: string;
  url: string;
  description: string;
  language: string;
  starsThisWeek: number;
  totalStars: number;
  hook: string;
  personalization: string;
  ownerAvatarUrl: string;
  // Real "Built by" avatars, capped by GitHub's own page (usually up to ~5) - never a total
  // contributor count, so never render a "+N" against this array's length. See fetch_github.js's
  // own comment on parseTrendingEntry for why.
  contributorAvatarUrls: string[];
};
