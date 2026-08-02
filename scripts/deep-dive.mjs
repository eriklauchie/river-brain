/**
 * Weekly deep dive.
 * Runs in GitHub Actions on a schedule, searches the web for anything new
 * about the Grand River, and appends findings to data/updates.json.
 * Nothing is ever overwritten. The brain only grows.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set.'); process.exit(1); }

const MODEL = 'claude-sonnet-4-6';
const FILE = 'data/updates.json';

const BRIEFS = [
  ['Construction progress',    'Grand Rapids WhiteWater Lower Reach construction, Grand River Revitalization Project, dam removal progress, Ah-Nab-Awen Park closures, Sixth Street Dam and sea lamprey barrier EIS.'],
  ['Hydrology and weather',    'Grand River Michigan flooding, ice jams, drought, low flow, high water, NWS Grand Rapids river forecasts, record readings.'],
  ['Fish and wildlife',        'Grand River Michigan lake sturgeon research, snuffbox mussel, salmon and steelhead runs, DNR stocking, sea lamprey, invasive species, new species findings.'],
  ['Events and community',     'Grand River Grand Rapids festivals, cleanups, paddling events, groundbreakings, DGRI and Grand River Network announcements, Grand River Greenway trail news.'],
  ['Regulations and advisories','Michigan DNR fishing regulation changes affecting the Grand River, MDHHS Eat Safe Fish advisories, EGLE permits, public health advisories.'],
  ['Development and funding',  'Grand Rapids riverfront development and funding, new projects, brownfield incentives, park and trail funding, millages, land sales along the Grand River.'],
  ['History and culture',      'Newly published Grand River Michigan history, archaeology, Grand River Bands of Ottawa Indians, museum exhibits, documentaries, books, archival discoveries.']
];

const SYSTEM = `You are a research agent updating the River Brain, a reference model of the Grand River through Grand Rapids, Michigan. Base research was compiled August 1, 2026.

Search the web and report ONLY genuinely new or changed information from roughly the last 30 days. Do not restate things already well known as of August 2026.

Format: 2 to 6 short bullets. Each bullet gives the fact, the date, and the source name in parentheses. Be specific with numbers and dates. Never use em dashes; use commas, colons or parentheses. If nothing has changed, reply with exactly: No change found.`;

async function claude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `${prompt}\n\nToday is ${new Date().toDateString()}.` }]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

const db = JSON.parse(readFileSync(FILE, 'utf8'));
const now = new Date();
const iso = now.toISOString();
const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
let added = 0;

for (const [title, topic] of BRIEFS) {
  try {
    const body = await claude(`Search for recent news about: ${topic}`);
    if (body && !/^no change found\.?$/i.test(body.trim())) {
      db.entries.unshift({ iso, date, title, body: body.trim() });
      added++;
      console.log(`+ ${title}`);
    } else {
      console.log(`  ${title}: no change`);
    }
  } catch (err) {
    console.error(`! ${title}: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 2500));
}

db.generated = iso;
db.gauges = {
  '04118564': 'https://waterdata.usgs.gov/nwis/uv?site_no=04118564&legacy=1',
  '04119000': 'https://waterdata.usgs.gov/nwis/uv?site_no=04119000&legacy=1'
};
db.entries = db.entries.slice(0, 400);
writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
console.log(`\nDone. ${added} new entr${added === 1 ? 'y' : 'ies'}. ${db.entries.length} total.`);
