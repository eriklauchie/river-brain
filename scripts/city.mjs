// Fetches downtown Grand Rapids from OpenStreetMap through Overpass and writes
// data/city.json: building footprints with heights, parks, and roads.
// The site drapes these over the 3D model. Run by .github/workflows/city.yml,
// or by hand: node scripts/city.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const BOX = [42.9505, -85.6895, 43.0005, -85.6605]; // south, west, north, east
const query = bb => `[out:json][timeout:120];(way["building"](${bb});way["leisure"~"^(park|garden|playground|pitch|dog_park)$"](${bb});way["landuse"~"^(grass|recreation_ground|cemetery|village_green)$"](${bb});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link)$"](${bb}););out geom;`;
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

function height(t){
  const num = s => { if(!s) return null; const m = String(s).match(/([\d.]+)\s*(ft|feet|')?/); if(!m) return null; const v = parseFloat(m[1]); return isFinite(v) ? (m[2] ? v*0.3048 : v) : null; };
  let h = num(t.height); if(h) return Math.min(h, 220);
  const lv = parseFloat(t['building:levels']); if(isFinite(lv) && lv > 0) return Math.min(lv*3.3 + 1, 220);
  const b = t.building || '';
  if(/house|residential|garage|shed|detached|hut/.test(b)) return 6;
  if(/church|cathedral/.test(b)) return 15;
  if(/parking|industrial|warehouse|retail|commercial|office|apartments|hotel/.test(b)) return 11;
  return 8;
}
function compact(osm){
  const out = {generated:new Date().toISOString(), src:'openstreetmap', attribution:'Map data from OpenStreetMap contributors, ODbL', buildings:[], parks:[], roads:[]};
  for(const el of (osm.elements || [])){
    if(el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags || {}, pts = el.geometry.map(g => [Math.round(g.lat*1e6)/1e6, Math.round(g.lon*1e6)/1e6]);
    if(t.building){ if(pts.length > 4 && pts.length < 400) out.buildings.push({p:pts.slice(0, -1), h:Math.round(height(t)*10)/10, n:t.name || ''}); }
    else if(t.highway){ out.roads.push({p:pts, w:/motorway|trunk/.test(t.highway) ? 26 : /primary/.test(t.highway) ? 16 : /secondary/.test(t.highway) ? 13 : /tertiary/.test(t.highway) ? 11 : 8}); }
    else if(pts.length > 3) out.parks.push({p:pts.slice(0, -1), n:t.name || ''});
  }
  return out;
}
// Overpass asks for a real User-Agent (without one overpass-api.de answers 406), and busy servers answer
// 429 or 504. So: name ourselves, try each server a few times with a growing wait (honouring Retry-After),
// and if the whole box keeps failing, fetch it as four smaller tiles and merge them.
const UA = 'river-brain-city-map/1.1 (+https://riverbrain.carbonstories.us; github.com/eriklauchie/river-brain)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastErr = null;
async function ask(url, bb){
  const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query(bb)),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(180000) });
  if(!r.ok){ const e = new Error(url + ' ' + r.status); e.retryAfter = +r.headers.get('retry-after') || 0; throw e; }
  return r.json();
}
async function fetchBox(box, minElements){
  const bb = box.join(',');
  for(const url of MIRRORS){
    for(let attempt = 1; attempt <= 3; attempt++){
      try{
        const osm = await ask(url, bb);
        if(osm && Array.isArray(osm.elements) && osm.elements.length >= minElements) return osm;
        throw new Error(url + ' answered with too little data (' + ((osm && osm.elements) || []).length + ' elements)');
      }catch(e){
        lastErr = e;
        const wait = Math.min(Math.max((e.retryAfter || 0) * 1000, 15000 * attempt), 90000);
        console.warn(`mirror failed (try ${attempt}): ${e.message}` + (attempt < 3 ? `, waiting ${wait / 1000}s` : ''));
        if(attempt < 3) await sleep(wait);
      }
    }
  }
  return null;
}
let osm = await fetchBox(BOX, 100);
if(!osm){
  console.warn('Whole box failed; trying four smaller tiles.');
  const [s, w, n, e] = BOX, mLat = (s + n) / 2, mLon = (w + e) / 2;
  const tiles = [[s, w, mLat, mLon], [s, mLon, mLat, e], [mLat, w, n, mLon], [mLat, mLon, n, e]];
  const seen = new Map();
  for(const t of tiles){
    const part = await fetchBox(t, 1);
    if(!part){ seen.clear(); break; }
    for(const el of part.elements) seen.set(el.type + el.id, el);
  }
  if(seen.size > 100) osm = { elements: [...seen.values()] };
}
if(!osm){ console.error('No Overpass mirror answered.', lastErr && lastErr.message); process.exit(1); }
const city = compact(osm);
mkdirSync('data', {recursive:true});
writeFileSync('data/city.json', JSON.stringify(city));
console.log(`data/city.json: ${city.buildings.length} buildings, ${city.parks.length} parks, ${city.roads.length} road segments, ${(JSON.stringify(city).length/1024).toFixed(0)} KB`);
