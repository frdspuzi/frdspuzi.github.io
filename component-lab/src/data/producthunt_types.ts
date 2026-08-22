export type ProductHuntPost = {
  name: string;
  tagline: string;
  url: string;
  website: string;
  votesCount: number;
  dailyRank: number;
  thumbnailUrl: string;
  // true when thumbnailUrl fell back to the product's square logo because no real (wide) launch
  // screenshot was available in Product Hunt's `media` array - see fetch_producthunt.js's own
  // parsePost comment. The card renders this shape differently (small, honest logo) rather than
  // stretching a square image into a 16/9 box.
  thumbnailIsLogo: boolean;
  hook: string;
  personalization: string;
  // Real makers only - Product Hunt's API returns { name: "[REDACTED]", profileImage: null } for
  // private/opted-out profiles, already filtered out in fetch_producthunt.js's own parsePost.
  makerNames: string[];
  makerAvatarUrls: string[];
  topics: string[];
};
