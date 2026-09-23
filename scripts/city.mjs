// Fetches downtown Grand Rapids from OpenStreetMap through Overpass and writes
// data/city.json: building footprints with heights, parks, and roads.
// The site drapes these over the 3D model. Run by .github/workflows/city.yml,
// or by hand: node scripts/city.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const BB = '42.9505,-85.6895,43.0005,-85.6605';
const Q = `[out:json][timeout:90];(way["building"](${BB});way["leisure"~"^(park|garden|playground|pitch|dog_park)$"](${BB});way["landuse"~"^(grass|recreation_ground|cemetery|village_green)$"](${BB});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link)$"](${BB}););out geom;`;
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
let osm = null, lastErr = null;
for(const url of MIRRORS){
  try{
    const r = await fetch(url, {method:'POST', body:'data=' + encodeURIComponent(Q), headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    if(!r.ok) throw new Error(url + ' ' + r.status);
    osm = await r.json(); if(osm && osm.elements && osm.elements.length > 100) break; osm = null;
  }catch(e){ lastErr = e; console.warn('mirror failed:', e.message); }
}
if(!osm){ console.error('No Overpass mirror answered.', lastErr && lastErr.message); process.exit(1); }
const city = compact(osm);
mkdirSync('data', {recursive:true});
writeFileSync('data/city.json', JSON.stringify(city));
console.log(`data/city.json: ${city.buildings.length} buildings, ${city.parks.length} parks, ${city.roads.length} road segments, ${(JSON.stringify(city).length/1024).toFixed(0)} KB`);
