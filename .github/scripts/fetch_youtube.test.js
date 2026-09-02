import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, parseAtomEntry, parseEvaluationResponse, findReusableEnrichment, buildEnrichmentLogEntry } from './fetch_youtube.js';

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Q&amp;A with &lt;guest&gt;')).toBe('Q&A with <guest>');
  });

  it('decodes numeric and hex entities', () => {
    expect(decodeHtmlEntities('&#39;quoted&#39; &amp; &#x2014; dash')).toBe("'quoted' & — dash");
  });

  it('passes through text with no entities unchanged', () => {
    expect(decodeHtmlEntities('plain text, nothing to decode')).toBe('plain text, nothing to decode');
  });

  it('returns falsy input unchanged', () => {
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe(null);
    expect(decodeHtmlEntities(undefined)).toBe(undefined);
  });
});

describe('parseAtomEntry', () => {
  it('extracts title, link, author, pubDate, and description from a real-shaped entry', () => {
    const entry = `
      <entry>
        <id>yt:video:abc123XYZ_9</id>
        <title>Q&amp;A: Building at Scale</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=abc123XYZ_9"/>
        <author>
          <name>Some Engineering Channel</name>
          <uri>https://www.youtube.com/channel/UCabc123</uri>
        </author>
        <published>2026-08-19T12:00:00+00:00</published>
        <media:group>
          <media:title>Q&amp;A: Building at Scale</media:title>
          <media:description>A deep dive into &lt;systems&gt; design.</media:description>
        </media:group>
      </entry>
    `;
    expect(parseAtomEntry(entry)).toEqual({
      title: 'Q&amp;A: Building at Scale',
      link: 'https://www.youtube.com/watch?v=abc123XYZ_9',
      author: 'Some Engineering Channel',
      pubDate: '2026-08-19T12:00:00+00:00',
      description: 'A deep dive into &lt;systems&gt; design.',
    });
  });

  it('takes the outer <title>, not the nested <media:title>', () => {
    const entry = `
      <entry>
        <title>Outer Title</title>
        <media:group><media:title>Inner Title</media:title></media:group>
      </entry>
    `;
    expect(parseAtomEntry(entry).title).toBe('Outer Title');
  });

  it('defaults every field to an empty string when the entry is missing them', () => {
    expect(parseAtomEntry('<entry></entry>')).toEqual({
      title: '',
      link: '',
      author: '',
      pubDate: '',
      description: '',
    });
  });
});

describe('parseEvaluationResponse', () => {
  it('parses a well-formed response', () => {
    const response = `{
      "evaluations": [
        { "videoId": "abc123", "title": "A Video", "selected": true, "reasoning": "Fits.", "summary": "Worth it." }
      ]
    }`;
    expect(parseEvaluationResponse(response)).toEqual([
      { videoId: 'abc123', title: 'A Video', selected: true, reasoning: 'Fits.', summary: 'Worth it.' },
    ]);
  });

  it('parses a response wrapped in a markdown code fence', () => {
    const response = '```json\n{"evaluations": [{"videoId": "abc123", "selected": false}]}\n```';
    expect(parseEvaluationResponse(response)).toEqual([{ videoId: 'abc123', selected: false }]);
  });

  it('returns an empty array, not a throw, for a truncated response (the real 2026-08-19 incident)', () => {
    // Real Gemini output from a production run: cut off mid-generation between two evaluation
    // objects (missing "}," / "{" right after the empty summary), because maxOutputTokens was
    // too small for the candidate volume at the time. JSON.parse throws a SyntaxError on this -
    // the whole point of parseEvaluationResponse is to catch that and degrade to an empty list
    // instead of the failure propagating uncaught.
    const truncatedResponse = `{
      "evaluations": [
        {
          "videoId": "kacf2bib-X0",
          "title": "Hands on with Gemini 3.7 Flash",
          "selected": true,
          "reasoning": "Directly relevant to his AI tooling interest.",
          "summary": "A hands-on look at the newest Gemini model."
        },
        {
          "videoId": "Sb2zfJhDUCM",
          "title": "EP19 #SembangKS | Cekodok, Mee dan LRT",
          "selected": false,
          "reasoning": "Casual commentary covering local gossip and partisan political banter.",
          "summary": ""
          "videoId": "zLUZclThLhU",
          "title": "Some Other Video",
          "selected": false,
          "reasoning": "Cut off here",
          "summary": ""
        }
      ]
    }`;
    expect(parseEvaluationResponse(truncatedResponse)).toEqual([]);
  });

  it('returns an empty array for falsy input', () => {
    expect(parseEvaluationResponse('')).toEqual([]);
    expect(parseEvaluationResponse(null)).toEqual([]);
    expect(parseEvaluationResponse(undefined)).toEqual([]);
  });

  it('returns an empty array when there is no JSON object in the response at all', () => {
    expect(parseEvaluationResponse('I refuse to answer that.')).toEqual([]);
  });
});

describe('findReusableEnrichment', () => {
  const enrichedExisting = {
    videoId: 'abc123XYZ_9',
    title: 'Some Video',
    summary: 'Already watched this one, real Vertex summary.',
    dateAdded: '2026-08-01T00:00:00.000Z',
    timestamps: [{ startTime: 0, endTime: 60, topic: 'Intro' }],
  };

  it('returns the existing summary, timestamps, and dateAdded for a video that was already successfully enriched', () => {
    expect(findReusableEnrichment('abc123XYZ_9', [enrichedExisting])).toEqual({
      summary: enrichedExisting.summary,
      timestamps: enrichedExisting.timestamps,
      dateAdded: enrichedExisting.dateAdded,
    });
  });

  it('returns null when the video is not in the existing list at all', () => {
    expect(findReusableEnrichment('brandNewVideo1', [enrichedExisting])).toBe(null);
  });

  it('returns null when the existing entry has empty timestamps (a past enrichment attempt failed, not a success worth reusing)', () => {
    const failedExisting = { ...enrichedExisting, timestamps: [] };
    expect(findReusableEnrichment('abc123XYZ_9', [failedExisting])).toBe(null);
  });

  it('returns null when the existing entry has no timestamps field at all', () => {
    const noTimestamps = { videoId: 'abc123XYZ_9', title: 'Some Video', summary: 'x', dateAdded: '2026-08-01T00:00:00.000Z' };
    expect(findReusableEnrichment('abc123XYZ_9', [noTimestamps])).toBe(null);
  });

  it('returns null for an empty existing list', () => {
    expect(findReusableEnrichment('abc123XYZ_9', [])).toBe(null);
  });
});

describe('buildEnrichmentLogEntry', () => {
  const video = { videoId: 'abc123XYZ_9', title: 'Some Video' };

  it('records a success outcome with no errors when the video succeeded on the first attempt', () => {
    const enriched = { summary: 'x', timestamps: [{ startTime: 0, endTime: 10, topic: 'Intro' }], errors: [] };
    expect(buildEnrichmentLogEntry(video, enriched)).toEqual({
      videoId: 'abc123XYZ_9',
      title: 'Some Video',
      outcome: 'success',
      errors: [],
    });
  });

  it('records a success outcome alongside prior failed attempts when it eventually succeeded', () => {
    const enriched = {
      summary: 'x',
      timestamps: [{ startTime: 0, endTime: 10, topic: 'Intro' }],
      errors: [{ attempt: 1, message: 'PERMISSION_DENIED: The caller does not have permission', status: 403 }],
    };
    expect(buildEnrichmentLogEntry(video, enriched)).toEqual({
      videoId: 'abc123XYZ_9',
      title: 'Some Video',
      outcome: 'success',
      errors: enriched.errors,
    });
  });

  it('records a failed outcome with the real error messages when every attempt failed', () => {
    const enriched = {
      summary: 'x',
      timestamps: [],
      errors: [
        { attempt: 1, message: 'PERMISSION_DENIED: The caller does not have permission', status: 403 },
        { attempt: 2, message: 'PERMISSION_DENIED: The caller does not have permission', status: 403 },
      ],
    };
    expect(buildEnrichmentLogEntry(video, enriched)).toEqual({
      videoId: 'abc123XYZ_9',
      title: 'Some Video',
      outcome: 'failed',
      errors: enriched.errors,
    });
  });

  it('records a failed outcome with no errors when GCP_PROJECT_ID was unset (enriched is a bare summary string, not an object)', () => {
    expect(buildEnrichmentLogEntry(video, 'a plain fallback summary string')).toEqual({
      videoId: 'abc123XYZ_9',
      title: 'Some Video',
      outcome: 'failed',
      errors: [],
    });
  });
});
