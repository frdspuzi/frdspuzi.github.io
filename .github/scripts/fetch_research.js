const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', '..', '_data', 'research_candidates.json');
const MAX_CANDIDATES_PER_TOPIC = 5;
const MAX_EXCERPT_CHARS = 5000;

const TOPIC_SOURCES = [
  {
    topic: 'Tech',
    sources: ['S4210226185', 'S118988714'] // PVLDB, JMLR
  },
  {
    topic: 'Islamic Studies & Finance',
    sources: ['S2737324406', 'S5407045253'] // JIMF, IJIFSD
  },
  {
    topic: 'Career & Productivity',
    sources: ['S202381698', 'S9692511'], // PLOS ONE, Frontiers in Psychology
    search: 'workplace OR productivity'
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

function threeMonthsAgoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function filterEligibleWorks(works, cutoffDate = threeMonthsAgoDate()) {
  if (!Array.isArray(works)) return [];
  return works.filter((w) => {
    if (w.is_retracted) return false;
    if (!w.is_oa) return false;
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
  let url = `https://api.openalex.org/works?filter=primary_location.source.id:${sourceId},is_oa:true,from_publication_date:${cutoffDate}&sort=publication_date:desc&per_page=5`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'frdspuzi.github.io/research-discovery' } });
    if (!res.ok) {
      console.warn(`OpenAlex returned HTTP ${res.status} for source ${sourceId}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Error querying OpenAlex for source ${sourceId}:`, err.message);
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

    for (const sourceId of config.sources) {
      if (validCandidates.length >= MAX_CANDIDATES_PER_TOPIC) break;

      const rawWorks = await fetchWorksForSource(sourceId, config.search, cutoff);
      const eligible = filterEligibleWorks(rawWorks, cutoff);

      for (const work of eligible) {
        if (validCandidates.length >= MAX_CANDIDATES_PER_TOPIC) break;

        const landingUrl = work.primary_location?.landing_page_url || work.doi;
        if (!landingUrl) continue;

        const html = await tryFetchFullText(landingUrl);
        if (!html) continue;

        const sections = extractSectionsFromHtml(html);
        if (!sections) continue;

        validCandidates.push({
          id: work.id,
          doi: work.doi || '',
          title: work.title,
          venue: work.primary_location?.source?.display_name || '',
          publicationDate: work.publication_date,
          fullTextUrl: landingUrl,
          introExcerpt: sections.intro,
          conclusionExcerpt: sections.conclusion,
          limitationsExcerpt: sections.limitations
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
