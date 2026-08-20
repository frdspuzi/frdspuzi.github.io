import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, parseTrendingEntry, parseTrendingPage, parseHookResponse } from './fetch_github.js';

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Q&amp;A with &lt;guest&gt;')).toBe('Q&A with <guest>');
  });

  it('returns falsy input unchanged', () => {
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe(null);
  });
});

// Trimmed to the exact structure the parser depends on (h2>a href, col-9 description, the
// programmingLanguage itemprop, the stargazers link, the trailing "stars this week" span) - real
// tag names/classes/ordering/content, verified against github.com/trending's actual markup, just
// stripped of the inline SVG icon paths that add bulk without adding anything the parser reads.
const REAL_SHAPED_ENTRY = `
<article class="Box-row">
  <div class="float-right d-flex">
    <div data-view-component="true" class="BtnGroup d-flex">
      <a href="/login?return_to=%2Fcathrynlavery%2Fdiagram-design" rel="nofollow" class="btn-sm btn">Star</a>
    </div>
  </div>

  <h2 class="h3 lh-condensed">
    <a href="/cathrynlavery/diagram-design" data-view-component="true" class="Link">
      <span data-view-component="true" class="text-normal">
        cathrynlavery /
      </span>
      diagram-design</a>  </h2>

    <p class="col-9 color-fg-muted my-1 tmp-pr-4">
      38 editorial diagram types for Claude Code, Codex, and Pi. Self-contained HTML + SVG.
    </p>

  <div class="f6 color-fg-muted mt-2">
    <span class="tmp-mr-3 d-inline-block ml-0 tmp-ml-0">
      <span class="repo-language-color" style="background-color: #e34c26"></span>
      <span itemprop="programmingLanguage">HTML</span>
    </span>

    <a href="/cathrynlavery/diagram-design/stargazers" data-view-component="true" class="tmp-mr-3 Link Link--muted d-inline-block">
        24,068</a>
    <a href="/cathrynlavery/diagram-design/forks" data-view-component="true" class="tmp-mr-3 Link Link--muted d-inline-block">
        1,464</a>
    <span data-view-component="true" class="d-inline-block float-sm-right">
        14,397 stars this week
    </span>
  </div>
</article>
`;

const ENTRY_WITH_ENTITY_DESCRIPTION = `
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/basecamp/omarchy" data-view-component="true" class="Link">
      <span class="text-normal">basecamp /</span>
      omarchy</a>  </h2>
    <p class="col-9 color-fg-muted my-1 tmp-pr-4">
      Beautiful, Modern &amp; Opinionated Linux
    </p>
  <div class="f6 color-fg-muted mt-2">
    <span class="tmp-mr-3 d-inline-block ml-0 tmp-ml-0">
      <span itemprop="programmingLanguage">Shell</span>
    </span>
    <a href="/basecamp/omarchy/stargazers" data-view-component="true" class="tmp-mr-3 Link Link--muted d-inline-block">
        26,963</a>
    <span data-view-component="true" class="d-inline-block float-sm-right">
        2,208 stars this week
    </span>
  </div>
</article>
`;

describe('parseTrendingEntry', () => {
  it('extracts fullName, url, description, language, and star counts from a real-shaped entry', () => {
    expect(parseTrendingEntry(REAL_SHAPED_ENTRY)).toEqual({
      fullName: 'cathrynlavery/diagram-design',
      url: 'https://github.com/cathrynlavery/diagram-design',
      description: '38 editorial diagram types for Claude Code, Codex, and Pi. Self-contained HTML + SVG.',
      language: 'HTML',
      starsThisWeek: 14397,
      totalStars: 24068,
    });
  });

  it('takes the h2 link href, not the star-button link that appears earlier in the article', () => {
    // The float-right star/login button's href also starts with "/login?return_to=..." which
    // encodes the real repo path - a naive "first href in the article" regex would grab that
    // instead of the actual repository link.
    expect(parseTrendingEntry(REAL_SHAPED_ENTRY).fullName).not.toContain('login');
  });

  it('decodes HTML entities in the description', () => {
    expect(parseTrendingEntry(ENTRY_WITH_ENTITY_DESCRIPTION).description).toBe('Beautiful, Modern & Opinionated Linux');
  });

  it('defaults to empty/zero fields for an entry missing them', () => {
    expect(parseTrendingEntry('<article class="Box-row"></article>')).toEqual({
      fullName: '',
      url: '',
      description: '',
      language: '',
      starsThisWeek: 0,
      totalStars: 0,
    });
  });
});

describe('parseTrendingPage', () => {
  it('parses every article on the page and drops any with no fullName', () => {
    const page = REAL_SHAPED_ENTRY + ENTRY_WITH_ENTITY_DESCRIPTION + '<article class="Box-row"></article>';
    const repos = parseTrendingPage(page);
    expect(repos).toHaveLength(2);
    expect(repos.map(r => r.fullName)).toEqual(['cathrynlavery/diagram-design', 'basecamp/omarchy']);
  });
});

describe('parseHookResponse', () => {
  it('parses a well-formed response', () => {
    const response = `{
      "repos": [
        { "fullName": "owner/repo", "hook": "It does a thing.", "personalization": "" }
      ]
    }`;
    expect(parseHookResponse(response)).toEqual([
      { fullName: 'owner/repo', hook: 'It does a thing.', personalization: '' },
    ]);
  });

  it('returns an empty array, not a throw, for a truncated response', () => {
    // Same shape of production incident fetch_youtube.js's parseEvaluationResponse test guards
    // against - a response cut off mid-generation, missing "}," / "{" between two entries.
    const truncated = `{
      "repos": [
        {
          "fullName": "owner/repo-one",
          "hook": "It does a thing.",
          "personalization": ""
          "fullName": "owner/repo-two",
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
