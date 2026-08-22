import { describe, it, expect } from 'vitest';
import { parsePost, parsePosts, parseHookResponse, todayWindow } from './fetch_producthunt.js';

// Real-shaped GraphQL edge, matching the actual field set confirmed against the live API
// (2026-08-22 investigation) - some makers legitimately come back as { name: "[REDACTED]",
// profileImage: null } for private/opted-out profiles, kept here to test that filtering.
// thumbnail is always a square logo (confirmed 1:1 against real API responses); media[] is where
// the real wide screenshots live (confirmed landscape, e.g. 1200x630) - both present here so the
// "media wins" preference actually gets exercised, not just the fallback path.
const REAL_SHAPED_EDGE = {
  node: {
    name: 'HyNote for Mac',
    tagline: 'Free local transcription that is 100% Private',
    url: 'https://www.producthunt.com/products/hynote-ai?utm_source=api',
    website: 'https://www.producthunt.com/r/abc123',
    votesCount: 378,
    dailyRank: 1,
    thumbnail: { url: 'https://ph-files.imgix.net/logo-square.png' },
    media: [
      { type: 'video', url: 'https://ph-files.imgix.net/video-poster.png', videoUrl: 'https://youtube.com/watch?v=x' },
      { type: 'image', url: 'https://ph-files.imgix.net/screenshot-wide.png', videoUrl: null },
    ],
    makers: [
      { name: 'Sandy Kong', profileImage: 'https://ph-avatars.imgix.net/1.jpeg' },
      { name: '[REDACTED]', profileImage: null },
      { name: 'Mia Lian', profileImage: 'https://ph-avatars.imgix.net/2.jpeg' },
    ],
    topics: { edges: [{ node: { name: 'Meetings' } }, { node: { name: 'Apple' } }] },
  },
};

describe('parsePost', () => {
  it('extracts name, tagline, urls, votes, rank, makers, and topics from a real-shaped edge', () => {
    expect(parsePost(REAL_SHAPED_EDGE)).toEqual({
      name: 'HyNote for Mac',
      tagline: 'Free local transcription that is 100% Private',
      url: 'https://www.producthunt.com/products/hynote-ai?utm_source=api',
      website: 'https://www.producthunt.com/r/abc123',
      votesCount: 378,
      dailyRank: 1,
      thumbnailUrl: 'https://ph-files.imgix.net/screenshot-wide.png',
      thumbnailIsLogo: false,
      makerNames: ['Sandy Kong', 'Mia Lian'],
      makerAvatarUrls: ['https://ph-avatars.imgix.net/1.jpeg', 'https://ph-avatars.imgix.net/2.jpeg'],
      topics: ['Meetings', 'Apple'],
    });
  });

  it('prefers the first type:"image" media entry over thumbnail (a square logo), skipping type:"video" entries', () => {
    const post = parsePost(REAL_SHAPED_EDGE);
    expect(post.thumbnailUrl).toBe('https://ph-files.imgix.net/screenshot-wide.png');
    expect(post.thumbnailUrl).not.toBe('https://ph-files.imgix.net/logo-square.png');
    expect(post.thumbnailIsLogo).toBe(false);
  });

  it('falls back to thumbnail (and flags thumbnailIsLogo) when media has no image entries', () => {
    const edge = {
      node: {
        ...REAL_SHAPED_EDGE.node,
        media: [{ type: 'video', url: 'https://ph-files.imgix.net/video-poster.png', videoUrl: 'https://youtube.com/x' }],
      },
    };
    const post = parsePost(edge);
    expect(post.thumbnailUrl).toBe('https://ph-files.imgix.net/logo-square.png');
    expect(post.thumbnailIsLogo).toBe(true);
  });

  it('falls back to thumbnail (and flags thumbnailIsLogo) when media is entirely absent', () => {
    const edge = { node: { ...REAL_SHAPED_EDGE.node, media: undefined } };
    const post = parsePost(edge);
    expect(post.thumbnailUrl).toBe('https://ph-files.imgix.net/logo-square.png');
    expect(post.thumbnailIsLogo).toBe(true);
  });

  it('filters out redacted/private makers (name "[REDACTED]", profileImage null)', () => {
    const post = parsePost(REAL_SHAPED_EDGE);
    expect(post.makerNames).not.toContain('[REDACTED]');
    expect(post.makerNames).toHaveLength(2);
  });

  it('defaults to empty/zero fields for a node missing them', () => {
    expect(parsePost({ node: {} })).toEqual({
      name: undefined,
      tagline: undefined,
      url: undefined,
      website: undefined,
      votesCount: undefined,
      dailyRank: undefined,
      thumbnailUrl: '',
      thumbnailIsLogo: true,
      makerNames: [],
      makerAvatarUrls: [],
      topics: [],
    });
  });
});

describe('parsePosts', () => {
  it('parses every edge and drops any with no name', () => {
    const edges = [REAL_SHAPED_EDGE, { node: {} }];
    const posts = parsePosts(edges);
    expect(posts).toHaveLength(1);
    expect(posts[0].name).toBe('HyNote for Mac');
  });
});

describe('parseHookResponse', () => {
  it('parses a well-formed response', () => {
    const response = `{
      "posts": [
        { "name": "HyNote for Mac", "hook": "It transcribes audio.", "personalization": "" }
      ]
    }`;
    expect(parseHookResponse(response)).toEqual([
      { name: 'HyNote for Mac', hook: 'It transcribes audio.', personalization: '' },
    ]);
  });

  it('returns an empty array, not a throw, for a truncated response', () => {
    const truncated = `{
      "posts": [
        {
          "name": "product-one",
          "hook": "It does a thing.",
          "personalization": ""
          "name": "product-two",
          "hook": "Cut off here",
          "personalization": ""
        }
      ]
    }`;
    expect(parseHookResponse(truncated)).toEqual([]);
  });

  it('returns an empty array for falsy input', () => {
    expect(parseHookResponse('')).toEqual([]);
    expect(parseHookResponse(null)).toEqual([]);
  });
});

describe('todayWindow', () => {
  it('returns a 24-hour UTC window starting at midnight today', () => {
    const { postedAfter, postedBefore } = todayWindow();
    const start = new Date(postedAfter);
    const end = new Date(postedBefore);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
