const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'research_candidates.json');
const MAX_CANDIDATES_PER_TOPIC = 5;
const MAX_EXCERPT_CHARS = 5000;

const TOPIC_SOURCES = [
  {
    topic: 'Tech',
    sources: ['S4210226185'], // PVLDB, also complemented by Hugging Face
    search: 'artificial intelligence OR large language models OR software engineering'
  },
  {
    topic: 'Islamic Studies & Finance',
    sources: ['S2737324406', 'S5407045253'], // JIMF, IJIFSD
    search: 'Islamic finance OR sukuk OR waqf'
  },
  {
    topic: 'Career & Productivity',
    sources: ['S202381698', 'S9692511'], // PLOS ONE, Frontiers
    search: 'workplace productivity OR developer wellbeing OR code review'
  }
];

function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        words[pos] = word;
      }
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

async function fetchHuggingFacePapers(limit = MAX_CANDIDATES_PER_TOPIC) {
  try {
    const res = await fetch('https://huggingface.co/api/daily_papers', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) {
      console.warn(`Hugging Face API returned HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const candidates = [];
    for (const item of (data || []).slice(0, 15)) {
      if (candidates.length >= limit) break;
      const p = item.paper || {};
      const title = item.title || p.title;
      const summary = item.summary || p.summary;
      if (!title || !summary) continue;

      const firstAuthor = p.authors?.[0]?.name || 'Author';
      const leadAuthor = (p.authors?.length || 0) > 1 ? `${firstAuthor} et al.` : firstAuthor;
      const pubDate = (item.publishedAt || p.publishedAt || '').slice(0, 10);
      const paperUrl = p.id ? `https://huggingface.co/papers/${p.id}` : (p.githubRepo || '');

      candidates.push({
        id: `hf:${p.id || title}`,
        doi: p.id ? `https://arxiv.org/abs/${p.id}` : '',
        title: title,
        venue: 'Hugging Face Daily Papers',
        leadAuthor,
        institution: '',
        topic: 'Tech',
        topics: ['Tech'],
        publicationDate: pubDate,
        fullTextUrl: paperUrl,
        codeUrl: p.githubRepo || undefined,
        introExcerpt: summary.slice(0, MAX_EXCERPT_CHARS),
        conclusionExcerpt: summary.slice(0, MAX_EXCERPT_CHARS),
        limitationsExcerpt: ''
      });
    }
    return candidates;
  } catch (err) {
    console.error('Error fetching Hugging Face daily papers:', err.message);
    return [];
  }
}

function threeMonthsAgoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function filterEligibleWorks(works, cutoffDate = threeMonthsAgoDate()) {
  if (!Array.isArray(works)) return [];
  return works.filter((w) => {
    if (w.is_retracted) return false;
    const isOa = w.open_access?.is_oa ?? w.is_oa;
    if (!isOa) return false;
    if (!w.publication_date || w.publication_date < cutoffDate) return false;
    return true;
  });
}

function extractSectionsFromHtml(html) {
  if (!html || typeof html !== 'string') return null;

  const introMatch = html.match(
    /<h[1-6][^>]*>\s*(?:[0-9]+\.?)?\s*Introduction\b[\s\S]*?<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/i
  );
  const conclMatch = html.match(
    /<h[1-6][^>]*>\s*(?:[0-9]+\.?)?\s*Conclusion[\s\S]*?<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/i
  );
  const limitMatch = html.match(
    /<h[1-6][^>]*>\s*(?:[0-9]+\.?)?\s*Limitations?\b[\s\S]*?<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/i
  );

  const intro = cleanText(introMatch ? introMatch[1] : '');
  const conclusion = cleanText(conclMatch ? conclMatch[1] : '');
  const limitations = cleanText(limitMatch ? limitMatch[1] : '');

  // Must have both intro and conclusion of meaningful length (> 50 chars)
  if (intro.length < 50 || conclusion.length < 50) {
    return null;
  }

  return {
    intro: intro.slice(0, MAX_EXCERPT_CHARS),
    conclusion: conclusion.slice(0, MAX_EXCERPT_CHARS),
    limitations: limitations ? limitations.slice(0, MAX_EXCERPT_CHARS) : ''
  };
}

function buildCandidatesPayload(topicGroups) {
  const allCandidates = [];

  for (const group of topicGroups) {
    const topic = group.topic;
    const capped = (group.candidates || []).slice(0, MAX_CANDIDATES_PER_TOPIC);
    for (const c of capped) {
      allCandidates.push({
        id: c.id,
        doi: c.doi || '',
        title: c.title,
        venue: c.venue || '',
        leadAuthor: c.leadAuthor || '',
        institution: c.institution || '',
        topic: topic,
        topics: [topic],
        publicationDate: c.publicationDate,
        fullTextUrl: c.fullTextUrl,
        introExcerpt: c.introExcerpt,
        conclusionExcerpt: c.conclusionExcerpt,
        limitationsExcerpt: c.limitationsExcerpt || ''
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    candidates: allCandidates
  };
}

async function fetchWorksForSource(sourceId, search, cutoffDate) {
  const filters = ['is_oa:true', `from_publication_date:${cutoffDate}`];
  if (sourceId) {
    filters.push(`primary_location.source.id:${sourceId}`);
  }
  let url = `https://api.openalex.org/works?filter=${filters.join(',')}&sort=cited_by_count:desc&per_page=5`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'frdspuzi.github.io/research-discovery' } });
    if (!res.ok) {
      console.warn(`OpenAlex returned HTTP ${res.status} for source ${sourceId || 'all'}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Error querying OpenAlex for source ${sourceId || 'all'}:`, err.message);
    return [];
  }
}

async function tryFetchFullText(url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return await res.text();
    }
    return null;
  } catch {
    return null;
  }
}

async function run() {
  const cutoff = threeMonthsAgoDate();
  console.log(`Starting research discovery intake (cutoff date: ${cutoff})...`);

  const topicGroups = [];

  for (const config of TOPIC_SOURCES) {
    console.log(`Querying works for topic: ${config.topic}...`);
    const validCandidates = [];

    // For Tech: fetch top Hugging Face daily papers first
    if (config.topic === 'Tech') {
      const hfPapers = await fetchHuggingFacePapers(MAX_CANDIDATES_PER_TOPIC);
      validCandidates.push(...hfPapers);
    }

    const sourcesToTry = [...(config.sources || [])];
    if (sourcesToTry.length === 0 || validCandidates.length < MAX_CANDIDATES_PER_TOPIC) {
      sourcesToTry.push(null); // broad OpenAlex query across all OA sources
    }

    for (const sourceId of sourcesToTry) {
      if (validCandidates.length >= MAX_CANDIDATES_PER_TOPIC) break;

      const rawWorks = await fetchWorksForSource(sourceId, config.search, cutoff);
      const eligible = filterEligibleWorks(rawWorks, cutoff);

      for (const work of eligible) {
        if (validCandidates.length >= MAX_CANDIDATES_PER_TOPIC) break;
        if (validCandidates.some((c) => c.id === work.id || c.title === work.title)) continue;

        const landingUrl = work.primary_location?.landing_page_url || work.doi;
        if (!landingUrl) continue;

        let intro = '';
        let conclusion = '';
        let limitations = '';

        const html = await tryFetchFullText(landingUrl);
        if (html) {
          const sections = extractSectionsFromHtml(html);
          if (sections) {
            intro = sections.intro;
            conclusion = sections.conclusion;
            limitations = sections.limitations;
          }
        }

        // Fallback to OpenAlex reconstructed abstract if HTML extraction blocked
        if (!intro && work.abstract_inverted_index) {
          const abstract = reconstructAbstract(work.abstract_inverted_index);
          if (abstract.length > 50) {
            intro = abstract.slice(0, MAX_EXCERPT_CHARS);
            conclusion = abstract.slice(0, MAX_EXCERPT_CHARS);
          }
        }

        if (!intro) continue;

        const authorships = work.authorships || [];
        const firstAuthor = authorships[0]?.author?.display_name || '';
        const leadAuthor = authorships.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
        const institution = authorships[0]?.institutions?.[0]?.display_name || '';

        validCandidates.push({
          id: work.id,
          doi: work.doi || '',
          title: work.title,
          venue: work.primary_location?.source?.display_name || '',
          leadAuthor,
          institution,
          publicationDate: work.publication_date,
          fullTextUrl: landingUrl,
          introExcerpt: intro,
          conclusionExcerpt: conclusion,
          limitationsExcerpt: limitations
        });
      }
    }

    topicGroups.push({ topic: config.topic, candidates: validCandidates });
    console.log(`Found ${validCandidates.length} qualifying candidates for ${config.topic}.`);
  }

  const payload = buildCandidatesPayload(topicGroups);
  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${payload.candidates.length} total candidates to ${OUTPUT_FILE}`);
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = {
  cleanText,
  threeMonthsAgoDate,
  filterEligibleWorks,
  extractSectionsFromHtml,
  buildCandidatesPayload,
  run
};
