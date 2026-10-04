import { describe, it, expect } from 'vitest';
import {
  filterEligibleWorks,
  extractSectionsFromHtml,
  cleanText,
  buildCandidatesPayload
} from './fetch_research.js';

describe('cleanText', () => {
  it('strips html tags, normalizes whitespace, and trims', () => {
    const raw = '<p>This is   <strong>important</strong> research.</p>\n<div>Next paragraph.</div>';
    expect(cleanText(raw)).toBe('This is important research. Next paragraph.');
  });
});

describe('filterEligibleWorks', () => {
  const cutoff = '2026-07-01';

  it('accepts recent, non-retracted open-access article', () => {
    const works = [
      {
        id: 'https://openalex.org/W1',
        title: 'Valid Paper',
        publication_date: '2026-08-15',
        is_oa: true,
        is_retracted: false,
        primary_location: { landing_page_url: 'https://example.com/p1' }
      }
    ];
    const eligible = filterEligibleWorks(works, cutoff);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].title).toBe('Valid Paper');
  });

  it('rejects retracted papers', () => {
    const works = [
      {
        id: 'https://openalex.org/W2',
        title: 'Retracted Paper',
        publication_date: '2026-08-15',
        is_oa: true,
        is_retracted: true
      }
    ];
    expect(filterEligibleWorks(works, cutoff)).toHaveLength(0);
  });

  it('rejects papers older than cutoff', () => {
    const works = [
      {
        id: 'https://openalex.org/W3',
        title: 'Old Paper',
        publication_date: '2025-01-01',
        is_oa: true,
        is_retracted: false
      }
    ];
    expect(filterEligibleWorks(works, cutoff)).toHaveLength(0);
  });

  it('rejects non-open-access papers', () => {
    const works = [
      {
        id: 'https://openalex.org/W4',
        title: 'Paywalled Paper',
        publication_date: '2026-08-15',
        is_oa: false,
        is_retracted: false
      }
    ];
    expect(filterEligibleWorks(works, cutoff)).toHaveLength(0);
  });
});

describe('extractSectionsFromHtml', () => {
  const sampleHtml = `
    <html>
      <body>
        <h1>A Study on Autonomous Systems</h1>
        <h2>1. Introduction</h2>
        <p>Autonomous systems require precise control algorithms to function safely.</p>
        <p>In this paper, we evaluate a novel path planner.</p>
        <h2>2. Methods</h2>
        <p>Detailed math and simulation parameters that should NOT be in the brief excerpt.</p>
        <h2>3. Limitations</h2>
        <p>The system was only evaluated in 2D simulated worlds and lacks sensor noise modeling.</p>
        <h2>4. Conclusion and Future Work</h2>
        <p>We demonstrated a 34% reduction in path error across 50 trials.</p>
      </body>
    </html>
  `;

  it('extracts introduction, conclusion, and optional limitations', () => {
    const result = extractSectionsFromHtml(sampleHtml);
    expect(result).not.toBeNull();
    expect(result.intro).toContain('Autonomous systems require precise control');
    expect(result.intro).not.toContain('Detailed math and simulation');
    expect(result.conclusion).toContain('We demonstrated a 34% reduction');
    expect(result.limitations).toContain('The system was only evaluated in 2D simulated worlds');
  });

  it('returns null if introduction is missing', () => {
    const htmlNoIntro = `<h2>4. Conclusion</h2><p>Done.</p>`;
    expect(extractSectionsFromHtml(htmlNoIntro)).toBeNull();
  });

  it('returns null if conclusion is missing', () => {
    const htmlNoConcl = `<h2>1. Introduction</h2><p>Start.</p>`;
    expect(extractSectionsFromHtml(htmlNoConcl)).toBeNull();
  });
});

describe('buildCandidatesPayload', () => {
  it('caps candidates per topic at 5 and includes metadata', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      id: `w-${i}`,
      title: `Paper ${i}`,
      topic: 'Tech',
      venue: 'PVLDB',
      publicationDate: '2026-08-01',
      fullTextUrl: `https://example.com/${i}`,
      introExcerpt: 'Intro...',
      conclusionExcerpt: 'Conclusion...',
      limitationsExcerpt: 'None'
    }));

    const payload = buildCandidatesPayload([
      { topic: 'Tech', candidates },
      { topic: 'Career & Productivity', candidates: candidates.slice(0, 2) }
    ]);

    expect(payload.candidates.filter(c => c.topic === 'Tech')).toHaveLength(5);
    expect(payload.candidates.filter(c => c.topic === 'Career & Productivity')).toHaveLength(2);
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
