// Fetches the Greenway's real geometry from OpenStreetMap through Overpass and writes
// data/greenway-geo.json for map.html:
//   river:    the Grand River and the creeks and rivers that join it in Kent County (for the flat fallback map)
//   trails:   built trails along the corridor, matched by name (White Pine, Kent Trails, Edges Trail, ...)
//   segments: for each project segment in data/greenway.json that has an `osm` spec, the road or path
//             it follows, clipped to that segment's box, so a planned trail is drawn on its real street.
// Run by .github/workflows/greenway.yml, or by hand: node scripts/greenway.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const BOX = [42.82, -85.92, 43.17, -85.30]; // south, west, north, east: Lowell to past the Ottawa County line
const RIVERS = '^(Grand River|Rogue River|Thornapple River|Flat River|Plaster Creek|Buck Creek|Indian Mill Creek|Bear Creek|Mill Creek)$';
const TRAILS = 'Edges|White Pine|Kent Trails|Millennium|Greenway|River ?[Ww]alk|Riverside|Johnson Park|Plaster Creek|Pettis|Rogue River|Thornapple|Fred Meijer|Grand River|Oxford|Indian Mounds|Chief Hazy|Lamar|North Park|Riverbend|Ada |Lowell|Buck Creek|Musketawa|Paul Henry|Cannonsburg|Northland|Leonard|Canal';
const UA = 'river-brain-greenway-map/1.0 (+https://riverbrain.carbonstories.us; github.com/eriklauchie/river-brain)';
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q){
  let last = null;
  for(const url of MIRRORS){
    for(let attempt = 1; attempt <= 3; attempt++){
      try{
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': UA },
          signal: AbortSignal.timeout(180000) });
        if(!r.ok){ const e = new Error(url + ' ' + r.status); e.retryAfter = +r.headers.get('retry-after') || 0; throw e; }
        const j = await r.json();
        if(!j || !Array.isArray(j.elements)) throw new Error(url + ' answered without elements');
        return j;
      }catch(e){
        last = e;
        const wait = Math.min(Math.max((e.retryAfter || 0) * 1000, 12000 * attempt), 60000);
        console.warn(`overpass failed (try ${attempt}): ${e.message}`);
        if(attempt < 3) await sleep(wait);
      }
    }
  }
  throw last || new Error('overpass failed');
}

// Douglas-Peucker in metres, then 5 decimals (about 1 m).
function simplify(pts, tol){
  if(pts.length < 3) return pts;
  const k = Math.cos(pts[0][1] * Math.PI / 180) * 111320, m = 110540;
  const xy = pts.map(p => [p[0] * k, p[1] * m]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while(stack.length){
    const [a, b] = stack.pop(); let best = -1, bi = -1;
    const [ax, ay] = xy[a], [bx, by] = xy[b], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    for(let i = a + 1; i < b; i++){
      const t = Math.max(0, Math.min(1, ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / L));
      const ex = ax + t * dx - xy[i][0], ey = ay + t * dy - xy[i][1], d = ex * ex + ey * ey;
      if(d > best){ best = d; bi = i; }
    }
    if(best > tol * tol){ keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]).map(p => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
}
const lineOf = el => (el.geometry || []).filter(Boolean).map(g => [g.lon, g.lat]);
function inBox(p, b){ return p[1] >= b[0] && p[1] <= b[2] && p[0] >= b[1] && p[0] <= b[3]; }
// Keep only the runs of a line that sit inside the box.
function clip(line, b){
  const runs = []; let cur = [];
  for(const p of line){ if(inBox(p, b)) cur.push(p); else { if(cur.length > 1) runs.push(cur); cur = []; } }
  if(cur.length > 1) runs.push(cur);
  return runs;
}
// Join ways that share an end so a trail is drawn as a few long lines, not hundreds of pieces.
function merge(lines){
  const key = p => p[0].toFixed(5) + ',' + p[1].toFixed(5);
  let pool = lines.map(l => l.slice()), changed = true;
  while(changed){
    changed = false;
    outer: for(let i = 0; i < pool.length; i++){
      for(let j = i + 1; j < pool.length; j++){
        const a = pool[i], b = pool[j];
        const a0 = key(a[0]), a1 = key(a[a.length - 1]), b0 = key(b[0]), b1 = key(b[b.length - 1]);
        let m = null;
        if(a1 === b0) m = a.concat(b.slice(1));
        else if(a1 === b1) m = a.concat(b.slice(0, -1).reverse());
        else if(a0 === b1) m = b.concat(a.slice(1));
        else if(a0 === b0) m = b.slice().reverse().concat(a.slice(1));
        if(m){ pool[i] = m; pool.splice(j, 1); changed = true; break outer; }
      }
    }
  }
  return pool;
}

const bb = BOX.join(',');
const out = { generated: new Date().toISOString(), src: 'openstreetmap', attribution: 'Map data from OpenStreetMap contributors, ODbL', box: BOX, river: [], trails: [], segments: {} };

// 1. Water
const water = await overpass(`[out:json][timeout:180];way["waterway"~"^(river|stream|canal)$"]["name"~"${RIVERS}"](${bb});out geom;`);
const byRiver = {};
for(const el of water.elements){ const n = el.tags.name; (byRiver[n] = byRiver[n] || []).push(lineOf(el)); }
for(const [name, lines] of Object.entries(byRiver)) out.river.push({ name, lines: merge(lines).map(l => simplify(l, name === 'Grand River' ? 12 : 8)) });
console.log('rivers', Object.keys(byRiver).length);
await sleep(4000);

// 2. Built trails by name, ways and route relations
const trails = await overpass(`[out:json][timeout:180];(way["highway"~"^(cycleway|path|footway|track|bridleway)$"]["name"~"${TRAILS}"](${bb});relation["route"~"^(bicycle|hiking|foot)$"]["name"~"${TRAILS}"](${bb}););out geom;`);
const byTrail = {};
for(const el of trails.elements){
  const n = (el.tags && el.tags.name) || ''; if(!n) continue;
  if(el.type === 'way') (byTrail[n] = byTrail[n] || []).push(lineOf(el));
  else if(el.type === 'relation') for(const m of el.members || []) if(m.type === 'way' && m.geometry) (byTrail[n] = byTrail[n] || []).push(m.geometry.filter(Boolean).map(g => [g.lon, g.lat]));
}
for(const [name, lines] of Object.entries(byTrail)){
  const clipped = lines.flatMap(l => clip(l, BOX));
  const merged = merge(clipped).map(l => simplify(l, 5)).filter(l => l.length > 1);
  if(merged.length) out.trails.push({ name, lines: merged });
}
console.log('trails', out.trails.length);

// 3. Project segments that follow a named road or path
const gw = JSON.parse(readFileSync(new URL('../data/greenway.json', import.meta.url)));
for(const seg of gw.segments || []){
  if(!seg.osm || !seg.osm.length) continue;
  const lines = [];
  for(const spec of seg.osm){
    await sleep(2500);
    const b = spec.bbox, hw = spec.highway || '.';
    try{
      const res = await overpass(`[out:json][timeout:90];way["highway"~"${hw}"]["name"~"${spec.name}"](${b.join(',')});out geom;`);
      for(const el of res.elements) lines.push(...clip(lineOf(el), b));
    }catch(e){ console.warn('segment', seg.id, e.message); }
  }
  if(lines.length) out.segments[seg.id] = merge(lines).map(l => simplify(l, 4));
  console.log('segment', seg.id, lines.length);
}

writeFileSync(new URL('../data/greenway-geo.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/greenway-geo.json');
