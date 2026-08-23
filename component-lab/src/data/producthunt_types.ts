export type ProductHuntPost = {
  name: string;
  tagline: string;
  url: string;
  website: string;
  votesCount: number;
  dailyRank: number;
  // Always a square logo/icon (Product Hunt's own thumbnail field) - rendered small and inline
  // next to the product name, the same treatment GithubTrendingList's RepoCard gives the repo
  // owner's avatar. Not a launch screenshot - see fetch_producthunt.js's parsePost comment for why.
  iconUrl: string;
  hook: string;
  personalization: string;
  // Real makers only - Product Hunt's API returns { name: "[REDACTED]", profileImage: null } for
  // private/opted-out profiles, already filtered out in fetch_producthunt.js's own parsePost.
  makerNames: string[];
  makerAvatarUrls: string[];
  topics: string[];
};
