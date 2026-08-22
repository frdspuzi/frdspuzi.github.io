export type ProductHuntPost = {
  name: string;
  tagline: string;
  url: string;
  website: string;
  votesCount: number;
  dailyRank: number;
  thumbnailUrl: string;
  hook: string;
  personalization: string;
  // Real makers only - Product Hunt's API returns { name: "[REDACTED]", profileImage: null } for
  // private/opted-out profiles, already filtered out in fetch_producthunt.js's own parsePost.
  makerNames: string[];
  makerAvatarUrls: string[];
  topics: string[];
};
