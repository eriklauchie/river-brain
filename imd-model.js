/* Indian Mounds Drive in 3D. Real geography: OpenStreetMap (river, roads, trails, parks, city
   limits), FEMA National Flood Hazard Layer (floodway, 100-year floodplain), USGS 3DEP ground.
   Drawn in the style of the study's maps and plans: grey ground, steel blue water, sage parks,
   the drive as a yellow (existing) or orange (proposed) line, yellow trailhead dots, dark green
   river activation areas, tree circles. Proposed features are placed by hand from the study's
   plan drawings (pp. 32-49, 56-57) along the real alignment, so they are illustrative.
   The Grand River Burial Mounds are not drawn, named or located. */
(function(){
'use strict';
if(typeof THREE === 'undefined') return;
var M = window.IMD_MODEL = {};
var EX = 2.5, ZREF = 179.0, FT = 0.3048;
var LEVELS = [[588, 'Summer river elevation'], [594, 'Ordinary high water mark (OHWM)'], [605, '100-year flood elevation']];
var ART = './art/imd/';
var C = { ground:'#e4e4e4', industrial:'#d9d9d9', grass:'#dfe6da', park:'#bdd1c3', wood:'#a9c7b6', wet:'#94c4b4', floodtint:'rgba(172,200,192,.55)', floodway:'#8aa0a0', water:'#7aa2bf', waterDeep:'#6b95b4',
  road:'#f7f7f7', roadCase:'#cfcfcf', mw:'#ffffff', mwCase:'#bdbdbd', rail:'#9a9a9a', trailnet:'#5f8f7e', boundary:'#6f7777', stream:'#9dbcd0',
  imdExisting:0xf2c318, imdProposed:0xf06420, entry:0xec2878, th:0xfcdc18, ra:0x287c54, thx:0xacd474, gate:0xe05430, sign:0xfcdc18, lot:0xa8a8a8, path:0xd9c9a3, board:0x8c6a4a, lawn:0xb0c46c, tree:0x6c8850, native:0xc9dca0, flood:0x5488b0, kt:0x5f8f7e, freeway:0xc8c8c8, freewayEdge:0xa9a9a9 };

var geo = null, dem = null, R = null, S = { mode:'proposed', phase:'future', traffic:false, floodLines:true, labels:true, trees:true, level:588, plan:false, section:false, xs:3200, xopt:'base', sel:null };
var stage, barEl, floodEl, xEl, hud, labelBox, cardEl, started = false, dirty = true;

/* ---------------------------------------------------------------- geometry helpers */
var IMD = { pts:[], st:[], len:0 };
function buildIMD(){
  IMD.pts = geo.imd.p; IMD.st = [0];
  for(var i = 1; i < IMD.pts.length; i++){ var a = IMD.pts[i - 1], b = IMD.pts[i]; IMD.st.push(IMD.st[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  IMD.len = IMD.st[IMD.st.length - 1];
}
/* point on the drive at station s, offset d metres (d > 0 is the river side, left of travel) */
function along(s, d){
  s = Math.max(0, Math.min(IMD.len, s));
  var i = 1; while(i < IMD.st.length - 1 && IMD.st[i] < s) i++;
  var a = IMD.pts[i - 1], b = IMD.pts[i], t = (s - IMD.st[i - 1]) / ((IMD.st[i] - IMD.st[i - 1]) || 1);
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  return [a[0] + (b[0] - a[0]) * t - dy * (d || 0), a[1] + (b[1] - a[1]) * t + dx * (d || 0), Math.atan2(dy, dx)];
}
var waterPts = null;
function bank(s){   /* distance from the drive to the nearest river vertex on the river side */
  if(!waterPts){ waterPts = []; geo.water.forEach(function(w){ if(w.o.length > 60) w.o.forEach(function(p){ waterPts.push(p); }); }); }
  var best = 1e9;
  for(var d = 20; d <= 200; d += 5){ var p = along(s, d); for(var k = 0; k < waterPts.length; k += 2){ var q = waterPts[k]; var dd = (q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]); if(dd < 400) return d; } }
  return 80;
}
function hAt(x, y){   /* ground elevation, metres */
  var g = dem, fx = (x - g.x0) / g.cell, fy = (y - g.y0) / g.cell;
  var i = Math.max(0, Math.min(g.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(g.ny - 2, Math.floor(fy)));
  var tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
  var z = g.z, w = g.nx;
  return z[j * w + i] * (1 - tx) * (1 - ty) + z[j * w + i + 1] * tx * (1 - ty) + z[(j + 1) * w + i] * (1 - tx) * ty + z[(j + 1) * w + i + 1] * tx * ty;
}
function Y(z){ return (z - ZREF) * EX; }
/* the drive's own elevation from the fine corridor profile (3 m lidar), falling back to the coarse grid */
function stationOf(x, y){
  var best = 0, bd = 1e18;
  for(var i = 0; i < IMD.pts.length - 1; i++){
    var a = IMD.pts[i], b = IMD.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)), px = a[0] + dx * t, py = a[1] + dy * t, d = (px - x) * (px - x) + (py - y) * (py - y);
    if(d < bd){ bd = d; best = IMD.st[i] + Math.sqrt(L2) * t; }
  }
  return best;
}
function trailZ(x, y){
  var pr = geo.profiles;
  if(!pr) return hAt(x, y);
  var s = stationOf(x, y), i = Math.max(0, Math.min(pr.z.length - 1, Math.round(s / pr.step)));
  var mid = Math.floor(pr.n / 2);
  return Math.max(hAt(x, y), pr.z[i][mid]);
}
function fineProfile(s, half, stepM){
  /* ground across the drive at station s from the fine profile, or the coarse grid */
  var pr = geo.profiles, out = [];
  if(pr && s <= (pr.z.length - 1) * pr.step){
    var i = Math.round(s / pr.step), row = pr.z[i], mid = Math.floor(pr.n / 2);
    for(var d = -half; d <= half; d += stepM){ var k = mid + Math.round(d / pr.dx); if(k >= 0 && k < pr.n) out.push([d, row[k]]); }
    if(out.length > 10) return out;
  }
  for(var d2 = -half; d2 <= half; d2 += stepM){ var p = along(s, d2); out.push([d2, hAt(p[0], p[1])]); }
  return out;
}
function riverZ(x, y){   /* lidar water surface along the corridor, by nearest profile station */
  var best = null, bd = 1e18;
  geo.riverProfile.forEach(function(r){ var d = (r[1] - x) * (r[1] - x) + (r[2] - y) * (r[2] - y); if(d < bd){ bd = d; best = r; } });
  return best ? best[3] : ZREF;
}
function levelZ(x, y){ return riverZ(x, y) + (S.level - 588) * FT - 0.25; }

/* ---------------------------------------------------------------- the ground texture */
var CW = 2048, CH = 1662, texCanvas, tex;
function tx(x){ return (x - geo.box[0]) / (geo.box[2] - geo.box[0]) * CW; }
function ty(y){ return (geo.box[3] - y) / (geo.box[3] - geo.box[1]) * CH; }
function pathPoly(ctx, poly){
  ctx.beginPath();
  var o = poly.o; ctx.moveTo(tx(o[0][0]), ty(o[0][1])); for(var i = 1; i < o.length; i++) ctx.lineTo(tx(o[i][0]), ty(o[i][1])); ctx.closePath();
  (poly.h || []).forEach(function(h){ ctx.moveTo(tx(h[0][0]), ty(h[0][1])); for(var i = 1; i < h.length; i++) ctx.lineTo(tx(h[i][0]), ty(h[i][1])); ctx.closePath(); });
}
function fillPolys(ctx, polys, fill){ ctx.fillStyle = fill; polys.forEach(function(p){ pathPoly(ctx, p); ctx.fill('evenodd'); }); }
function strokePolys(ctx, polys, stroke, w, dash){ ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.setLineDash(dash || []); polys.forEach(function(p){ pathPoly(ctx, p); ctx.stroke(); }); ctx.setLineDash([]); }
function strokeLines(ctx, lines, stroke, w, dash){
  ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []);
  ctx.beginPath();
  lines.forEach(function(l){ var p = l.p; ctx.moveTo(tx(p[0][0]), ty(p[0][1])); for(var i = 1; i < p.length; i++) ctx.lineTo(tx(p[i][0]), ty(p[i][1])); });
  ctx.stroke(); ctx.setLineDash([]);
}
function drawTexture(){
  if(!texCanvas){ texCanvas = document.createElement('canvas'); texCanvas.width = CW; texCanvas.height = CH; }
  var ctx = texCanvas.getContext('2d');
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, CW, CH);
  fillPolys(ctx, geo.industrial, C.industrial);
  fillPolys(ctx, geo.grass, C.grass);
  fillPolys(ctx, geo.parks, C.park);
  fillPolys(ctx, geo.woods, C.wood);
  fillPolys(ctx, geo.wetlands, C.wet);
  if(S.floodLines){ fillPolys(ctx, geo.flood100, C.floodtint); }
  /* streets, lightest first */
  var by = {}; geo.roads.forEach(function(r){ (by[r.c] = by[r.c] || []).push(r); });
  strokeLines(ctx, by.res || [], '#f3f3f3', 1.6);
  strokeLines(ctx, by.ter || [], C.roadCase, 3.2); strokeLines(ctx, by.ter || [], C.road, 2);
  strokeLines(ctx, (by.sec || []).concat(by.pri || []), C.roadCase, 4.4); strokeLines(ctx, (by.sec || []).concat(by.pri || []), '#fff', 2.8);
  strokeLines(ctx, by.mw || [], C.mwCase, 7); strokeLines(ctx, by.mw || [], C.mw, 4.6);
  strokeLines(ctx, geo.rail, C.rail, 1.6, [6, 4]);
  strokeLines(ctx, geo.streams.filter(function(s){ return !s.r; }), C.stream, 1.4);
  fillPolys(ctx, geo.water, C.water);
  strokePolys(ctx, geo.water, C.waterDeep, 1.2);
  strokeLines(ctx, geo.trails, C.trailnet, 1.5);
  if(S.floodLines){ strokePolys(ctx, geo.floodway, C.floodway, 1.6); strokePolys(ctx, geo.flood100, C.floodway, 1.2, [3, 4]); }
  strokeLines(ctx, geo.boundaries, C.boundary, 1.3, [10, 5, 2, 5]);
  if(tex) tex.needsUpdate = true;
}

/* ---------------------------------------------------------------- meshes */
function ribbon(pts, width, lift, color, opts){
  opts = opts || {};
  var n = pts.length, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [], acc = 0;
  for(var i = 0; i < n; i++){
    var p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    var nx = -dy * width / 2, ny = dx * width / 2;
    var z = opts.flat !== undefined ? opts.flat : (opts.z ? opts.z(p, i) : hAt(p[0], p[1])) + lift;
    if(i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    pos.set([p[0] - nx, Y(z), -(p[1] - ny), p[0] + nx, Y(z), -(p[1] + ny)], i * 6);
    uv.set([0, acc / width, 1, acc / width], i * 4);
    if(i){ var k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  var mat = opts.map ? new THREE.MeshLambertMaterial({map:opts.map, side:THREE.DoubleSide}) : new THREE.MeshLambertMaterial({color:color, side:THREE.DoubleSide, transparent:!!opts.opacity, opacity:opts.opacity || 1});
  var m = new THREE.Mesh(g, mat); m.renderOrder = opts.order || 1; return m;
}
function densify(pts, step){
  var out = [pts[0]];
  for(var i = 1; i < pts.length; i++){ var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for(var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return out;
}
function disc(x, y, r, color, lift, ring){
  var g = new THREE.Group(), z = Y(hAt(x, y) + (lift || 0.6));
  if(ring){ var o = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 28), new THREE.MeshBasicMaterial({color:0xffffff})); o.rotation.x = -Math.PI / 2; o.position.set(x, z, -y); g.add(o); }
  var m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({color:color})); m.rotation.x = -Math.PI / 2; m.position.set(x, z + 0.3, -y); g.add(m);
  g.renderOrder = 4; return g;
}
function pill(x, y, w, h, ang, color, lift){
  var sh = new THREE.Shape(), r = h / 2; sh.moveTo(-w / 2 + r, -r); sh.lineTo(w / 2 - r, -r); sh.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(-w / 2 + r, r); sh.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  var g = new THREE.Group();
  var o = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({color:0xffffff})); o.scale.set(1.18, 1.3, 1);
  var m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({color:color}));
  [o, m].forEach(function(mm, i){ mm.rotation.x = -Math.PI / 2; mm.rotation.z = ang; mm.position.set(x, Y(hAt(x, y) + (lift || 0.7)) + i * 0.3, -y); g.add(mm); });
  g.renderOrder = 4; return g;
}
function rect(cx, cy, w, h, ang, color, lift, opacity){
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({color:color, transparent:!!opacity, opacity:opacity || 1}));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ang; m.position.set(cx, Y(hAt(cx, cy) + (lift || 0.5)), -cy); m.renderOrder = 3; return m;
}
function box(cx, cy, w, d, h, ang, color){
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h * EX, d), new THREE.MeshLambertMaterial({color:color}));
  m.rotation.y = ang; m.position.set(cx, Y(hAt(cx, cy)) + h * EX / 2, -cy); return m;
}
var spriteTex = {};
function sprite(x, y, file, size, lift){
  if(!spriteTex[file]) spriteTex[file] = new THREE.TextureLoader().load(ART + file, function(){ dirty = true; });
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({map:spriteTex[file], depthTest:false, transparent:true})); sp.scale.set(size, size, 1); sp.userData.baseY = Y(hAt(x, y)); sp.position.set(x, sp.userData.baseY + (lift || size * .6), -y); sp.renderOrder = 9; return sp;
}
function stripeTexture(kind){
  var c = document.createElement('canvas'); c.width = 64; c.height = 256; var g = c.getContext('2d');
  g.fillStyle = kind === 'existing' ? '#8f8f8f' : '#9c9c9c'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#fff';
  if(kind === 'existing'){ g.fillStyle = '#e8c23a'; g.fillRect(30, 0, 4, 256); g.fillStyle = '#fff'; g.fillRect(14, 0, 2, 256); }   /* yellow centre line, bike lane line */
  else if(kind === 'buffered'){ g.fillRect(22, 0, 2, 256); g.fillStyle = '#9fb47a'; g.fillRect(24, 0, 16, 256); g.fillStyle = '#fff'; for(var y = 0; y < 256; y += 32) g.fillRect(51, y, 2, 16); }   /* ped 8', bioswale 8', bike 7'+7' */
  else { g.fillRect(22, 0, 2, 256); for(var y2 = 0; y2 < 256; y2 += 32) g.fillRect(42, y2, 2, 16); }   /* ped 8' | bike 7'+7' with a dashed centre */
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); return t;
}

/* ---------------------------------------------------------------- the scene */
var scene, camera, renderer, groups = {}, labels = [], pickables = [], terrain, water, trailMesh, trailLine, stripes = {}, xsMarker;
var cam = { target:new THREE.Vector3(-700, 0, -300), theta:0.35, phi:0.95, dist:5200 };
function build(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 5, 80000);
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0xe6e6e6, 1);
  stage.innerHTML = ''; stage.appendChild(renderer.domElement);
  labelBox = document.createElement('div'); labelBox.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; stage.appendChild(labelBox);
  hud = document.createElement('div'); hud.className = 'hud'; stage.appendChild(hud);
  stage.insertAdjacentHTML('beforeend', '<svg class="north" viewBox="0 0 30 30" aria-hidden="true"><path d="M15 3 L22 25 L15 20 L8 25 Z" fill="#3d4747"/><text x="15" y="29" text-anchor="middle" font-size="7" font-family="Work Sans" fill="#3d4747">N</text></svg><div class="scale"><i></i><span>500 ft</span></div><div class="ntsbtn"><button class="imd-chip" data-act="plan" title="Look straight down, north up, like the study’s overall plan">Plan view</button><button class="imd-chip" data-act="reset" title="Back to the oblique view">Reset</button></div>');
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0b8, 0.62));
  var sun = new THREE.DirectionalLight(0xffffff, 0.42); sun.position.set(-3000, 6000, 4000); scene.add(sun);

  /* ground */
  var g = dem, nx = g.nx, ny = g.ny, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for(var j = 0; j < ny; j++) for(var i = 0; i < nx; i++){
    var k = j * nx + i, x = g.x0 + i * g.cell, y = g.y0 + j * g.cell;
    pos[k * 3] = x; pos[k * 3 + 1] = Y(g.z[k]); pos[k * 3 + 2] = -y; uv[k * 2] = i / (nx - 1); uv[k * 2 + 1] = j / (ny - 1);
    if(i < nx - 1 && j < ny - 1) idx.push(k, k + 1, k + nx, k + 1, k + nx + 1, k + nx);
  }
  var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  drawTexture(); tex = new THREE.CanvasTexture(texCanvas); tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.flipY = true;
  terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({map:tex})); scene.add(terrain);

  /* flood water: the FEMA 100-year polygons lifted to the chosen level */
  water = new THREE.Group();
  geo.flood100.forEach(function(poly){
    var sh = new THREE.Shape(poly.o.map(function(p){ return new THREE.Vector2(p[0], p[1]); }));
    (poly.h || []).forEach(function(h){ sh.holes.push(new THREE.Path(h.map(function(p){ return new THREE.Vector2(p[0], p[1]); }))); });
    var sg = new THREE.ShapeGeometry(sh); var a = sg.attributes.position;
    for(var v = 0; v < a.count; v++){ var x = a.getX(v), yy = a.getY(v); a.setXYZ(v, x, Y(levelZ(x, yy)), -yy); }
    sg.computeVertexNormals();
    water.add(new THREE.Mesh(sg, new THREE.MeshLambertMaterial({color:C.flood, transparent:true, opacity:0.78, depthWrite:false})));
  });
  water.renderOrder = 6; scene.add(water);

  /* I-196 on its embankment */
  groups.fixed = new THREE.Group(); scene.add(groups.fixed);
  geo.roads.filter(function(r){ return r.c === 'mw' && r.p.length > 1; }).forEach(function(r){
    var pts = densify(r.p, 40);
    var wide = !!r.n;   /* the freeway itself is named, its ramps are not */
    groups.fixed.add(ribbon(pts, wide ? 34 : 15, wide ? 4.5 : 3.5, C.freewayEdge, {order:2}));
    groups.fixed.add(ribbon(pts, wide ? 26 : 10, wide ? 4.9 : 3.9, C.freeway, {order:2}));
  });
  /* Wilson Ave bridge (M-11) and Kent Trails bridge decks */
  geo.roads.filter(function(r){ return r.b && /Wilson/.test(r.n || '') && Math.abs(r.p[0][0] + 2850) < 300; }).forEach(function(r){ groups.fixed.add(ribbon(densify(r.p, 20), 22, 7.5, 0xbfbfbf, {order:2})); });
  geo.trails.filter(function(r){ return /Kent Trails/.test(r.n || ''); }).forEach(function(r){ groups.fixed.add(ribbon(densify(r.p, 25), r.b ? 5 : 3.2, r.b ? 7.5 : 0.6, C.kt, {order:2})); });

  /* the drive: asphalt with the study's striping, and the schematic plan line above it */
  var dp = densify(IMD.pts, 20);
  var zTrail = function(p){ return trailZ(p[0], p[1]); };
  stripes.existing = stripeTexture('existing'); stripes.base = stripeTexture('base'); stripes.buffered = stripeTexture('buffered');
  trailMesh = ribbon(dp, 6.7, 0.6, 0x999999, {map:stripes.base, order:3, z:zTrail}); scene.add(trailMesh);
  groups.lineExisting = new THREE.Group(); groups.lineExisting.add(ribbon(dp, 3.2, 1.2, C.imdExisting, {order:4, z:zTrail})); scene.add(groups.lineExisting);
  groups.lineProposed = new THREE.Group();
  var gateS = 640;
  var sPts = [], nPts = [], acc = 0;
  for(var q = 0; q < dp.length; q++){ if(q) acc += Math.hypot(dp[q][0] - dp[q - 1][0], dp[q][1] - dp[q - 1][1]); (acc <= gateS ? sPts : nPts).push(dp[q]); }
  nPts.unshift(sPts[sPts.length - 1]);
  groups.lineProposed.add(ribbon(sPts, 4, 1.2, C.entry, {order:4, z:zTrail})); groups.lineProposed.add(ribbon(nPts, 3.6, 1.2, C.imdProposed, {order:4, z:zTrail}));
  scene.add(groups.lineProposed);

  buildMarkers(); buildFeatures(); buildTrees(); buildLabels();
  xsMarker = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 260), new THREE.MeshBasicMaterial({color:0xffffff})); xsMarker.visible = false; scene.add(xsMarker);
  applyState(); resize();
  if(typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  bindInput(); requestAnimationFrame(frame);
  stage.querySelector('.loading') && stage.querySelector('.loading').remove();
}

/* markers: trailheads, river activation areas, existing trailheads, access points, count sites */
var FOCUS = {
  wps:{n:'Waterfront Park South Trailhead', kind:'th', s:170, d:-30, page:36, img:'fa-wps.webp', view:{dist:650, theta:0.6}},
  wpn:{n:'Waterfront Park North Trailhead', kind:'th', s:520, d:0, page:38, img:'fa-wpn.webp', view:{dist:650, theta:0.4}},
  ivan:{n:'Ivanrest Trailhead', kind:'th', xy:[-905, -585], page:40, img:'fa-ivanrest.webp', view:{dist:560, theta:0.3}},
  gate:{n:'North Gateway at Market Ave.', kind:'th', s:6330, d:-14, page:42, img:'fa-gateway.webp', view:{dist:560, theta:0.9}},
  ra1:{n:'River Activation 1', kind:'ra', s:2000, d:30, len:480, page:44, img:'fa-ra1.webp', view:{dist:820, theta:0.2}},
  ra2:{n:'River Activation 2', kind:'ra', s:3400, d:30, len:480, page:46, img:'fa-ra2.webp', view:{dist:820, theta:0.3}},
  ra3:{n:'River Activation 3', kind:'ra', s:5200, d:30, len:290, page:48, img:'fa-ra3.webp', view:{dist:650, theta:0.5}}
};
var SITES = [['Site #1','Grandville Waterfront Park',461,1322,null,{s:150,d:0}],['Site #2','Begin one-way road',252,1266,1526,{s:660,d:0}],['Site #3','Kent Trails to Ivanrest',108,723,null,{xy:[-960,-120]}],['Site #4','Kent Trails Bridge to Millennium',790,1933,null,{xy:[740,1200]}],['Site #5','Market Ave. connection',23,265,1400,{s:6420,d:0}]];
var EXISTING_TH = [[-2800,-330],[-2880,-1120],[-2700,-1250],[-1500,560],[-1250,1250],[-900,2420],[-990,-600],[1300,1960],[480,-640]];
function xyOf(f){ if(f.xy) return f.xy; var p = along(f.s, f.d || 0); return [p[0], p[1]]; }
function buildMarkers(){
  groups.proposedMarks = new THREE.Group(); groups.existingMarks = new THREE.Group(); groups.access = new THREE.Group(); groups.traffic = new THREE.Group();
  Object.keys(FOCUS).forEach(function(id){
    var f = FOCUS[id], p = xyOf(f), m;
    if(f.kind === 'th'){ m = disc(p[0], p[1], 42, C.th, 0.4, true); m.traverse(function(o){ if(o.isMesh){ o.material.transparent = true; o.userData.fade = 1; } }); }
    else { var a = along(f.s, 0)[2]; m = pill(p[0], p[1], f.len, 110, a, C.ra, 0.35); m.traverse(function(o){ if(o.isMesh){ o.material.transparent = true; o.userData.fade = 1; } }); }
    m.userData = {focus:id}; m.traverse(function(o){ o.userData.focus = id; if(o.isMesh) pickables.push(o); });
    groups.proposedMarks.add(m);
  });
  EXISTING_TH.forEach(function(p){ groups.existingMarks.add(disc(p[0], p[1], 32, C.thx, 1.5, true)); });
  /* access points as the study's icons */
  [[along(20, 0), 'leg-ped.png'], [along(3400, -10), 'leg-ped.png'], [along(5260, 30), 'leg-ped.png'], [along(6430, 0), 'leg-ped.png'], [[1600, 2480], 'leg-ped.png'], [along(330, -30), 'leg-car.png'], [along(300, 60), 'leg-boat.png'], [along(560, 90), 'leg-kayak.png']].forEach(function(a){ groups.access.add(sprite(a[0][0], a[0][1], a[1], 120, 70)); });
  /* count sites: a bubble sized by the seven-day total, blue for trail counts, orange where cars were counted */
  SITES.forEach(function(s){
    var p = xyOf(s[5]), tot = s[2] + s[3] + (s[4] || 0), r = 60 + Math.sqrt(tot) * 3.4;
    var m = disc(p[0], p[1], r, s[4] ? 0xec9078 : 0x709cc0, 3, false); m.children[0].material.transparent = true; m.children[0].material.opacity = 0.55;
    groups.traffic.add(m);
    labels.push({x:p[0], y:p[1], lift:40, cls:'site', html:'<b>' + s[0] + ':</b> ' + s[1] + '<br>Peds <b style="color:#9cac94">' + s[2] + '</b> · Cyclists <b>' + s[3].toLocaleString() + '</b>' + (s[4] ? ' · <em>Motorists ' + s[4].toLocaleString() + '</em>' : ''), group:'traffic'});
  });
  [groups.proposedMarks, groups.existingMarks, groups.access, groups.traffic].forEach(function(g){ scene.add(g); });
}
/* proposed features, from the focus area plans. (s, d) are metres along the drive and sideways; d > 0 toward the river. */
function buildFeatures(){
  var F = groups.features = new THREE.Group(), P = groups.pilot = new THREE.Group(), A = groups.amenities = new THREE.Group();
  function lot(s0, s1, d0, d1){ var sm = (s0 + s1) / 2, dm = (d0 + d1) / 2, p = along(sm, dm); F.add(rect(p[0], p[1], s1 - s0, Math.abs(d1 - d0), p[2], C.lot, 0.9)); stripesOn(s0, s1, d0, d1); }
  function stripesOn(s0, s1, d0, d1){ for(var s = s0 + 6; s < s1; s += 6){ var p = along(s, (d0 + d1) / 2); F.add(rect(p[0], p[1], 0.3, Math.abs(d1 - d0) * .8, p[2], 0xffffff, 1.1)); } }
  function strip(ptsSD, w, color, lift){ var pts = ptsSD.map(function(q){ var p = along(q[0], q[1]); return [p[0], p[1]]; }); F.add(ribbon(densify(pts, 8), w, lift || 0.9, color, {order:4})); }
  function patch(s, d, w, h, color, op){ var p = along(s, d); var m = rect(p[0], p[1], w, h, p[2], color, 0.6, op); F.add(m); }
  function blob(s, d, rx, ry, color){ var p = along(s, d); var m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshLambertMaterial({color:color})); m.scale.set(rx, ry, 1); m.rotation.x = -Math.PI / 2; m.rotation.z = p[2]; m.position.set(p[0], Y(hAt(p[0], p[1]) + 0.55), -p[1]); m.renderOrder = 3; F.add(m); }
  function small(s, d, size, color, h){ var p = along(s, d); F.add(box(p[0], p[1], size, size, h || 1.2, -p[2], color)); }
  function treesAt(s, d, n, spread){ var p = along(s, d); for(var i = 0; i < n; i++){ var a = Math.random() * 6.283, r = Math.random() * spread; treeList.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 5 + Math.random() * 4]); } }
  function gate(s){ var p = along(s, 0); P.add(box(p[0], p[1], 1.2, 9, 1.4, -p[2], C.gate)); labels.push({x:p[0], y:p[1], lift:6, cls:'road', html:'Access control gate', group:'pilot'}); }
  function sign(s){ var p = along(s, -6); P.add(disc(p[0], p[1], 7, C.sign, 1.2, true)); }

  /* Waterfront Park South, p. 36 */
  lot(60, 210, -15, 15); lot(215, 300, -12, 12);
  strip([[150, 28], [240, 30], [330, 30]], 3.7, C.path);            /* 12' shared-use trail */
  patch(300, 58, 10, 36, 0xb5b5b5); patch(312, 66, 3, 30, 0x8f8f8f);  /* boat launch and skid pier */
  small(285, 38, 5, C.path, 0.6);                                   /* rest area */
  strip([[112, 34], [128, 48]], 3, 0xcfcfcf);                       /* river access steps */
  treesAt(120, 48, 7, 20);                                          /* picnic area in the existing poplar grove */
  patch(180, -26, 270, 10, C.native, 0.9); patch(170, 20, 150, 6, C.native, 0.9);  /* native landscape */
  strip([[0, 0], [-30, -20]], 3, C.path);                           /* to Ottawa County and Buck Creek trails */
  /* Waterfront Park North, p. 38 */
  strip([[350, 42], [470, 44], [600, 40]], 3.7, C.path);            /* 12' shared-use path, river side */
  strip([[350, -46], [470, -48], [640, -40]], 3, C.path);           /* 10' shared-use path toward M-11 */
  lot(540, 585, 10, 24); lot(600, 640, 8, 22); lot(585, 640, -8, -24);  /* 7, 7, 7+4 spots */
  blob(600, 34, 16, 12, 0xbcbcbc); small(604, 36, 3, 0x6b4d36, 1.5); /* plaza with picnic tables and kiosk */
  patch(590, 90, 6, 22, 0xa0a0a0);                                   /* universally accessible kayak launch */
  patch(640, 6, 12, 6, 0xb0b0b0);                                    /* pull off */
  patch(470, 60, 240, 10, C.native, 0.9);
  /* North Gateway at Market Ave., p. 42 */
  lot(6290, 6400, -8, -30);
  strip([[6250, 10], [6438, 12]], 3.7, C.path);                      /* 12' shared-use trail */
  small(6300, -6, 3, 0x6b4d36, 1.5);                                 /* kiosk and bike repair station */
  patch(6340, -36, 120, 2, 0x8d8d8d, 1.3);                           /* retaining wall with guardrail */
  small(6425, 14, 2.5, 0xe05430, 2.2);                               /* park entry sign */
  treesAt(6345, -42, 10, 55);
  /* River Activation 1, p. 44 */
  var b1 = bank(2000);
  strip([[1780, 12], [1840, 30], [1900, b1 - 14], [1990, b1 - 10], [2060, b1 - 18], [2130, 28], [2230, 14]], 2.5, C.path);        /* barrier-free nature trails */
  strip([[1860, 16], [1900, b1 - 16]], 2.2, C.board, 1.4); strip([[2050, 20], [2090, b1 - 14]], 2.2, C.board, 1.4);            /* elevated boardwalks over wetland restoration */
  blob(1885, (b1) / 2 + 4, 42, 14, 0x8fb59a); blob(2070, (b1) / 2 + 2, 40, 13, 0x8fb59a);                                   /* wetland restoration */
  small(1995, b1 - 8, 5, C.path, 0.6); small(2060, b1 - 12, 4, C.path, 0.6);                                                 /* river overlook and social areas */
  small(1900, b1 - 4, 3, 0xcfcfcf, 0.5); small(2160, b1 - 4, 3, 0xcfcfcf, 0.5);                                              /* river access points */
  patch(1980, -7, 14, 6, 0xb0b0b0); small(2200, 10, 4, C.path, 0.6);                                                           /* pull off, rest area */
  strip([[2010, -8], [2040, -40], [2070, -80]], 2.5, C.path);                                                                  /* to Kent County Parks natural area (future) */
  /* River Activation 2, p. 46 */
  var b2 = bank(3400);
  strip([[3180, 12], [3230, b2 - 16], [3320, b2 - 12], [3420, b2 - 18], [3520, b2 - 12], [3600, 20], [3640, 12]], 2.5, C.path);
  strip([[3240, 16], [3270, b2 - 14]], 2.2, C.board, 1.4); strip([[3380, 16], [3420, b2 - 16]], 2.2, C.board, 1.4); strip([[3540, 18], [3580, b2 - 12]], 2.2, C.board, 1.4);
  blob(3260, b2 / 2 + 2, 36, 12, 0x8fb59a); blob(3400, b2 / 2, 44, 14, 0x8fb59a); blob(3560, b2 / 2 + 2, 34, 12, 0x8fb59a);
  treesAt(3300, b2 - 20, 6, 16); treesAt(3600, b2 - 18, 6, 16);                                                               /* picnic groves */
  small(3230, b2 - 8, 5, C.path, 0.6); small(3420, b2 - 10, 4, C.path, 0.6); small(3395, -8, 3, 0x6b4d36, 1.5);                 /* overlook, rest area, kiosk */
  small(3330, b2 - 3, 3, 0xcfcfcf, 0.5); small(3520, b2 - 3, 3, 0xcfcfcf, 0.5);
  patch(3190, -7, 14, 6, 0xb0b0b0); patch(3620, -7, 14, 6, 0xb0b0b0);
  small(3240, b2 + 4, 2, 0x7a7a7a, 1.2);                                                                                        /* existing clean water plant outfall */
  /* River Activation 3, p. 48 */
  var b3 = bank(5200);
  strip([[5050, 12], [5120, b3 - 16], [5200, b3 - 10], [5260, b3 - 6], [5300, 14]], 2.5, C.path);
  patch(5275, b3 - 4, 26, 10, 0xd6d0c4);                                                                                        /* river access for viewing, fishing, portage */
  small(5225, b3 - 10, 4, C.path, 0.6); small(5295, 8, 3, 0x6b4d36, 1.5); patch(5150, -7, 30, 6, 0xb0b0b0);                      /* rest area, kiosk, pull off (5 spots) */
  /* Ivanrest Trailhead, p. 40, laid out east of Kent Trails and north of Porter St. */
  (function(){
    var o = [-905, -585], a = 0;
    function R2(x, y, w, h, c, lift, op){ var m = rect(x, y, w, h, a, c, lift || 0.8, op); F.add(m); }
    R2(-968, -590, 60, 55, C.lot, 0.9); for(var s = -992; s < -944; s += 6) F.add(rect(s, -590, 0.3, 44, 0, 0xffffff, 1.1));   /* parking (28 spots) */
    F.add(box(-950, -568, 8, 6, 3.5, 0, 0xe05430));                                                                               /* restroom */
    F.add(box(-928, -604, 9, 9, 3.5, 0, 0x8c6a4a));                                                                               /* picnic pavilion */
    F.add(box(-934, -585, 3, 3, 1.5, 0, 0x6b4d36));                                                                               /* wayfinding kiosk, bike repair station, rest area */
    var lawn = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshLambertMaterial({color:C.lawn})); lawn.scale.set(34, 26, 1); lawn.rotation.x = -Math.PI / 2; lawn.position.set(-895, Y(hAt(-895, -590) + 0.55), 590); lawn.renderOrder = 3; F.add(lawn);
    var loop = [[-955, -560], [-915, -555], [-870, -575], [-862, -605], [-900, -625], [-945, -615], [-958, -585]]; F.add(ribbon(densify(loop, 6), 2.5, 0.9, C.path, {order:4}));
    F.add(box(-866, -598, 5, 5, 1.2, 0, 0xcfcfcf));                                                                               /* creek overlook */
    R2(-830, -560, 70, 40, 0x8fb59a, 0.6);                                                                                        /* floodplain restoration */
    for(var i = 0; i < 24; i++) treeList.push([-860 + Math.random() * 70, -585 + Math.random() * 50, 5 + Math.random() * 4]);
    R2(-900, -642, 150, 3, 0xa9a9a9, 1.2);                                                                                        /* perimeter fence along Porter St. */
  })();
  /* amenities along the whole trail: pull-offs every 1/8 mile, rest areas and lights every 1/4 mile (p. 34) */
  for(var s = 800; s < IMD.len - 150; s += 201){ var p = along(s, -6); A.add(rect(p[0], p[1], 14, 5, p[2], 0xb0b0b0, 0.8)); }
  for(var s2 = 900; s2 < IMD.len - 150; s2 += 402){ var p2 = along(s2, 8); A.add(box(p2[0], p2[1], 3, 3, 0.8, -p2[2], C.path)); var p3 = along(s2 + 100, -5); A.add(box(p3[0], p3[1], 0.6, 0.6, 5, 0, 0xffffff)); }
  /* pilot project: two controlled gates and signage (p. 56) */
  gate(640); gate(6290); for(var s3 = 1000; s3 < IMD.len - 300; s3 += 900) sign(s3);
  labels.push({x:along(3500, 0)[0], y:along(3500, 0)[1], lift:30, cls:'fa', html:'Pilot trail facility', group:'pilot'});
  scene.add(F); scene.add(P); scene.add(A);
}
var treeList = [];
function pointIn(poly, x, y){ var o = poly.o, c = false; for(var i = 0, j = o.length - 1; i < o.length; j = i++){ if(((o[i][1] > y) !== (o[j][1] > y)) && (x < (o[j][0] - o[i][0]) * (y - o[i][1]) / ((o[j][1] - o[i][1]) || 1e-9) + o[i][0])) c = !c; } return c; }
function buildTrees(){
  /* the study's plan drawings use tree circles; scatter them in the mapped woods and wetlands within 650 m of the drive */
  var near = function(x, y){ for(var s = 0; s <= IMD.len; s += 200){ var p = along(s, 0); if(Math.hypot(p[0] - x, p[1] - y) < 650) return true; } return false; };
  geo.woods.concat(geo.wetlands).forEach(function(poly){
    var xs = poly.o.map(function(p){ return p[0]; }), ys = poly.o.map(function(p){ return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var area = (x1 - x0) * (y1 - y0), n = Math.min(500, Math.round(area / 9000));
    for(var i = 0; i < n * 2 && treeList.length < 2600; i++){ var x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0); if(pointIn(poly, x, y) && near(x, y)) treeList.push([x, y, 7 + Math.random() * 7]); }
  });
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 31, 0, 6.283); g.fill(); g.fillStyle = '#6c8850'; g.beginPath(); g.arc(32, 32, 27, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 14, 0, 6.283); g.stroke();
  var t = new THREE.CanvasTexture(c);
  var mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:0.82, alphaTest:0.3, depthWrite:false}), treeList.length);
  var o = new THREE.Object3D();
  treeList.forEach(function(tr, i){ o.position.set(tr[0], Y(hAt(tr[0], tr[1]) + 1.6 + (i % 7) * 0.05), -tr[1]); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.set(tr[2], tr[2], 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
  mesh.renderOrder = 5; groups.trees = mesh; scene.add(mesh);
}
function buildLabels(){
  var L = [
    ['Grand River', -2700, -900, 'water'], ['Grand River', -1000, 760, 'water'], ['Grand River', 1150, 1700, 'water'],
    ['Millennium Park', -1500, 1500, 'place'], ['Millennium Park · Secchia Meadows', -1000, 2600, 'place'], ['Millennium Park · Rec Core', -1300, 1000, 'place'],
    ['Johnson Park', -2850, -250, 'place'], ['Lamar Park', 474, -613, 'place'], ['Walker', -2800, 1900, 'city'], ['Grandville', -2000, -2400, 'city'], ['Wyoming', 1600, -900, 'city'], ['Grand Rapids', 2400, 2500, 'city'],
    ['I-196 Gerald R. Ford Freeway', -1600, 40, 'road'], ['I-196 Gerald R. Ford Freeway', 1000, 800, 'road'], ['28th St. (M-11)', 300, -1500, 'road'], ['Chicago Drive', -300, -300, 'road'], ['Ivanrest Ave.', -1000, -1400, 'road'], ['Wilson Ave. (M-11)', -2520, -2100, 'road'], ['Veteran’s Memorial Dr.', -2350, 220, 'road'], ['Maynard Ave.', -740, 2476, 'road'], ['Butterworth St.', 1200, 2300, 'road'], ['Market Ave.', 2000, 2300, 'road'], ['Kent Trails', -970, -300, 'road'], ['Kent Trails Bridge', 745, 1240, 'road'], ['Wilson Ave. Bridge', -2850, -1300, 'road'],
    ['One-way road begins', -2520, -980, 'road'], ['One-way road ends', 1480, 1980, 'road']
  ];
  L.forEach(function(l){ labels.push({x:l[1], y:l[2], lift:10, cls:l[3] === 'water' ? 'water' : l[3] === 'road' ? 'road' : '', html:l[0], big:l[3] === 'city'}); });
  Object.keys(FOCUS).forEach(function(id){ var f = FOCUS[id], p = xyOf(f); labels.push({x:p[0], y:p[1], lift:f.kind === 'ra' ? 34 : 18, cls:'fa' + (f.kind === 'ra' ? ' ra' : ''), html:f.n, group:'proposed', focus:id}); });
  labels.forEach(function(l){
    var el = document.createElement('div'); el.className = 'lbl ' + (l.cls || ''); el.innerHTML = l.html; if(l.big) el.style.fontSize = '12px';
    if(l.focus){ el.addEventListener('click', function(e){ e.stopPropagation(); openCard(l.focus); }); }
    labelBox.appendChild(el); l.el = el; l.z = Y(hAt(l.x, l.y)) + l.lift;
  });
}

/* ---------------------------------------------------------------- state and UI */
function applyState(){
  var prop = S.mode === 'proposed';
  groups.lineExisting.visible = !prop; groups.lineProposed.visible = prop;
  groups.proposedMarks.visible = prop; groups.features.visible = prop && S.phase === 'future'; groups.amenities.visible = prop && S.phase === 'future';
  groups.pilot.visible = prop && S.phase === 'pilot';
  groups.existingMarks.visible = true; groups.access.visible = true;
  groups.traffic.visible = S.traffic; groups.trees.visible = S.trees;
  trailMesh.material.map = prop ? stripes[S.xopt] : stripes.existing; trailMesh.material.needsUpdate = true;
  water.visible = S.level > 588.4; water.children.forEach(function(m){ var a = m.geometry.attributes.position; for(var v = 0; v < a.count; v++){ var x = a.getX(v), y = -a.getZ(v); a.setY(v, Y(levelZ(x, y))); } a.needsUpdate = true; });
  labels.forEach(function(l){ l.hidden = (l.group === 'traffic' && !S.traffic) || (l.group === 'proposed' && !prop) || (l.group === 'pilot' && !(prop && S.phase === 'pilot')) || (!l.group && !S.labels); });
  xsMarker.visible = S.section;
  if(S.section){ var p = along(S.xs, 0); xsMarker.position.set(p[0], Y(trailZ(p[0], p[1]) + 2), -p[1]); xsMarker.rotation.y = -p[2]; }
  renderBar(); renderFlood(); renderX();
  var lv = LEVELS.filter(function(l){ return Math.abs(l[0] - S.level) < 0.5; })[0];
  hud.innerHTML = '<b>' + (prop ? (S.phase === 'pilot' ? 'Pilot project 2027-2029 (p. 56)' : 'Overall plan and future modules (pp. 32-57)') : 'Existing conditions (pp. 12-19)') + '</b> · water at <b>' + Math.round(S.level) + '’</b>' + (lv ? ', ' + lv[1] : '') + '<small><br>Real ground, river, roads and flood zones (USGS, OpenStreetMap, FEMA); heights 2.5x. Proposed features placed from the study’s plans, illustrative. Drag to orbit, pinch or scroll to zoom, two fingers or right-drag to pan. Tap a focus area.</small>';
  dirty = true;
}
function chip(act, val, on, text, title){ return '<button class="imd-chip' + (on ? ' on' : '') + '" data-act="' + act + '"' + (val !== undefined ? ' data-val="' + val + '"' : '') + (title ? ' title="' + title + '"' : '') + '>' + text + '</button>'; }
function renderBar(){
  var prop = S.mode === 'proposed';
  barEl.innerHTML = '<span class="grp"><span class="lab">Show</span>' + chip('mode', 'existing', !prop, 'Existing') + chip('mode', 'proposed', prop, 'Proposed') + '</span>' +
    (prop ? '<span class="grp"><span class="lab">Phase</span>' + chip('phase', 'pilot', S.phase === 'pilot', '<i style="background:#e05430"></i>Pilot 2027-29') + chip('phase', 'future', S.phase === 'future', '<i style="background:#f06420"></i>Future modules') + '</span>' : '') +
    (prop && S.phase === 'future' ? '<span class="grp"><span class="lab">Trail</span>' + chip('xopt', 'base', S.xopt === 'base', 'Base') + chip('xopt', 'buffered', S.xopt === 'buffered', 'Buffered') + '</span>' : '') +
    '<span class="grp"><span class="lab">Layers</span>' + chip('traffic', '', S.traffic, 'Count sites', 'Traffic study, pp. 16-17') + chip('floodLines', '', S.floodLines, 'Flood zones', 'FEMA floodway and 100-year floodplain') + chip('trees', '', S.trees, 'Trees') + chip('labels', '', S.labels, 'Labels') + chip('section', '', S.section, 'Cross section', 'Trail design options, pp. 34-35') + '</span>' +
    '<span class="grp fly"><span class="lab">Fly to</span>' + Object.keys(FOCUS).map(function(id){ return chip('fly', id, S.sel === id, '<i style="background:' + (FOCUS[id].kind === 'ra' ? '#287c54' : '#fcdc18') + '"></i>' + FOCUS[id].n.replace(' Trailhead', '').replace(' at Market Ave.', '')); }).join('') + '</span>';
}
function renderFlood(){
  floodEl.innerHTML = '<span class="lab">Water</span>' + LEVELS.map(function(l){ return chip('level', l[0], Math.abs(S.level - l[0]) < 0.5, l[0] + '’ ' + (l[0] === 588 ? 'summer' : l[0] === 594 ? 'OHWM' : '100-year flood')); }).join('') +
    '<input type="range" min="588" max="605" step="0.5" value="' + S.level + '" data-act="levelrange" aria-label="Water level in feet"><span class="lv">Water surface <b>' + S.level.toFixed(1) + ' ft</b>, ' + Math.round((S.level - 588) * 12) + ' in above summer</span>';
}
function renderX(){
  xEl.hidden = !S.section;
  if(!S.section) return;
  var mi = Math.round(S.xs / 1609.34 * 100) / 100;
  xEl.innerHTML = '<div class="row"><span class="lab">Station</span><input type="range" min="0" max="' + Math.floor(IMD.len) + '" step="10" value="' + S.xs + '" data-act="xs" aria-label="Position along the drive"><span class="lv">' + mi.toFixed(2) + ' mi from Waterfront Park South · ' + ['base', 'buffered'].map(function(o){ return '<button class="imd-chip' + (S.xopt === o ? ' on' : '') + '" data-act="xopt" data-val="' + o + '">' + o + ' trail</button>'; }).join(' ') + '</span></div>' + sectionSVG();
}
function sectionSVG(){
  /* a cross section through the real ground, perpendicular to the drive, with the study's three water lines and the trail template */
  var W = 900, H = 290, half = 130, p0 = along(S.xs, 0), rz = riverZ(p0[0], p0[1]);
  var pts = fineProfile(S.xs, half, 2), zmin = 1e9, zmax = -1e9;
  pts.forEach(function(q){ zmin = Math.min(zmin, q[1]); zmax = Math.max(zmax, q[1]); });
  var z605 = rz + 17 * FT, z588 = rz, z594 = rz + 6 * FT;
  zmin = Math.min(zmin, z588) - 1; zmax = Math.max(zmax, z605) + 1.5;
  var L = 150, Rm = 30, top = 95, bot = 46;
  var sx = function(d){ return L + (d + half) / (2 * half) * (W - L - Rm); }, sy = function(z){ return top + (zmax - z) / (zmax - zmin) * (H - top - bot); };
  var ground = 'M' + sx(-half) + ' ' + sy(zmin - 5) + pts.map(function(q){ return 'L' + sx(q[0]) + ' ' + sy(q[1]); }).join('') + 'L' + sx(half) + ' ' + sy(zmin - 5) + 'Z';
  var lvl = rz + (S.level - 588) * FT, inW = false, wp = '';
  pts.forEach(function(q){ if(q[1] < lvl){ if(!inW){ wp += 'M' + sx(q[0]) + ' ' + sy(lvl); inW = true; } wp += 'L' + sx(q[0]) + ' ' + sy(q[1]); } else if(inW){ wp += 'L' + sx(q[0]) + ' ' + sy(lvl) + 'Z'; inW = false; } });
  if(inW) wp += 'L' + sx(half) + ' ' + sy(lvl) + 'Z';
  var ztr = trailZ(p0[0], p0[1]) + 0.3, y = sy(ztr), base = S.xopt === 'base';
  /* the 22 foot template, river side on the left; widths in metres */
  var segs = base ? [[-3.35, -0.9, '#9c9c9c', 'Pedestrian path 8’'], [-0.9, 3.35, '#9c9c9c', 'Two-way bike facility 7’ + 7’'], [-5.8, -3.35, '#9fb47a', 'Bioswale 8’'], [3.35, 5.8, '#9fb47a', 'Bioswale 8’']]
                  : [[-5.8, -3.35, '#9c9c9c', 'Pedestrian path 8’'], [-3.35, -0.9, '#9fb47a', 'Bioswale 8’'], [-0.9, 3.35, '#9c9c9c', 'Two-way bike facility 7’ + 7’'], [3.35, 5.8, '#9fb47a', 'Bioswale 8’']];
  segs.sort(function(a, b){ return a[0] - b[0]; });
  var tmpl = '', n = segs.length;
  segs.forEach(function(s, i){
    var x0 = sx(s[0]), x1 = sx(s[1]), cx = (x0 + x1) / 2, lx = sx(0) + (i - (n - 1) / 2) * 150;
    tmpl += '<rect x="' + x0 + '" y="' + (y - 4) + '" width="' + (x1 - x0) + '" height="4" fill="' + s[2] + '"/>';
    tmpl += '<path d="M' + cx + ' ' + (y - 6) + 'L' + cx + ' ' + (y - 26) + 'L' + lx + ' ' + (y - 44) + 'L' + lx + ' ' + (y - 52) + '" fill="none" stroke="#545858" stroke-width=".6"/>';
    tmpl += '<text x="' + lx + '" y="' + (y - 56) + '" text-anchor="middle" font-size="7.5">' + s[3] + '</text>';
  });
  var line = function(z, color, dash, label){ return '<line x1="' + sx(-half) + '" x2="' + sx(half) + '" y1="' + sy(z) + '" y2="' + sy(z) + '" stroke="' + color + '" stroke-width="1"' + (dash ? ' stroke-dasharray="6 4"' : '') + '/><text x="' + (L - 8) + '" y="' + (sy(z) + 3) + '" text-anchor="end" font-size="8" fill="' + color + '">' + label + '</text>'; };
  return '<svg class="imd-xsec" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cross section of the corridor at this point">' +
    '<path d="' + ground + '" fill="#d9d9d9"/><path d="' + wp + '" fill="#8fb0c7" opacity=".55"/>' +
    line(z605, '#e05430', true, '605’ 100-year flood') + line(z594, '#8a8f8f', false, '594’ OHWM') + line(z588, '#5488b0', false, '588’ summer river') +
    tmpl + '<text x="' + sx(0) + '" y="' + (y - 78) + '" text-anchor="middle" font-size="8">High ground 40’-66’</text><line x1="' + sx(-9) + '" x2="' + sx(9) + '" y1="' + (y - 74) + '" y2="' + (y - 74) + '" stroke="#545858" stroke-width=".6"/>' +
    '<text x="' + sx(half) + '" y="' + (H - 24) + '" text-anchor="end" font-size="8">Land side, toward I-196 →</text><text x="' + sx(-half) + '" y="' + (H - 24) + '" text-anchor="start" font-size="8">← Grand River side</text>' +
    '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="7.5" fill="#8a8f8f">Ground from USGS 3DEP lidar' + (geo.profiles ? ' at 3 m' : '') + ', ' + Math.round(2 * half * 3.281) + ' ft across, stretched vertically. Water lines from the study, p. 34, set on the lidar river surface here.</text></svg>';
}
function openCard(id){
  var f = FOCUS[id]; if(!f) return;
  S.sel = id; closeCard();
  var D = window.IMD_FOCUS_TEXT || {};
  var text = D[id] || '';
  cardEl = document.createElement('div'); cardEl.className = 'imd-card3d';
  cardEl.innerHTML = '<img src="' + ART + f.img + '" alt="Plan drawing of ' + f.n + ' from the study"><button class="x" aria-label="Close">×</button><div class="bd"><h4><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:' + (f.kind === 'ra' ? '#287c54' : '#fcdc18') + ';margin-right:6px;vertical-align:-1px"></span>' + f.n + '</h4>' + text + '<div class="acts"><a class="imd-btn" href="#imd-fa-' + id + '">Read the focus area</a><a class="imd-btn" href="' + pdfAt(f.page) + '" target="_blank" rel="noopener">PDF pp. ' + f.page + '-' + (f.page + 1) + '</a></div><p class="imd-note" style="margin:8px 0 0">Focus area, Indian Mounds Drive Feasibility Study, pp. ' + f.page + '-' + (f.page + 1) + '. Placement on the model is illustrative.</p></div>';
  cardEl.querySelector('.x').addEventListener('click', closeCard);
  cardEl.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
  cardEl.addEventListener('wheel', function(e){ e.stopPropagation(); });
  stage.appendChild(cardEl); renderBar();
}
function closeCard(){ if(cardEl){ cardEl.remove(); cardEl = null; } }
function pdfAt(p){ return 'https://www.kentcountymi.gov/DocumentCenter/View/11050/Indian-Mounds-Drive-Feasibility-Study-PDF#page=' + (Math.floor(p / 2) + 1); }

M.fly = function(id){
  var f = FOCUS[id]; if(!f) return;
  var p = xyOf(f); S.sel = id;
  if(S.mode !== 'proposed'){ S.mode = 'proposed'; S.phase = 'future'; applyState(); }
  animateTo({target:new THREE.Vector3(p[0], Y(hAt(p[0], p[1])), -p[1]), dist:f.view.dist, phi:0.78, theta:f.view.theta});
  openCard(id);
};
M.preset = function(v){
  if(v === 'inventory'){ S.mode = 'existing'; S.traffic = false; }
  else if(v === 'traffic'){ S.mode = 'existing'; S.traffic = true; }
  else if(v === 'flood'){ S.level = 605; }
  else if(v === 'proposed'){ S.mode = 'proposed'; S.phase = 'future'; setPlan(true); }
  else if(v === 'pilot'){ S.mode = 'proposed'; S.phase = 'pilot'; setPlan(true); }
  else if(v === 'future'){ S.mode = 'proposed'; S.phase = 'future'; setPlan(true); }
  else if(v === 'section'){ S.section = true; }
  applyState();
};
function setPlan(on){ S.plan = on; if(on) animateTo({target:new THREE.Vector3(-700, 0, -300), dist:7600, phi:0.06, theta:0}); else animateTo({target:new THREE.Vector3(-700, 0, -300), dist:5200, phi:0.95, theta:0.35}); }
var anim = null;
function animateTo(to){ anim = {t0:performance.now(), dur:900, from:{target:cam.target.clone(), dist:cam.dist, phi:cam.phi, theta:cam.theta}, to:to}; dirty = true; }

/* ---------------------------------------------------------------- input */
function bindInput(){
  var ptrs = {}, last = null, moved = 0, pinch0 = 0, dist0 = 0, mid0 = null;
  stage.addEventListener('pointerdown', function(e){
    if(e.target.closest('.imd-chip, .ntsbtn, .imd-card3d')) return;
    stage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; moved = 0;
    var ks = Object.keys(ptrs); if(ks.length === 2){ var a = ptrs[ks[0]], b = ptrs[ks[1]]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = cam.dist; mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    last = [e.clientX, e.clientY];
  });
  stage.addEventListener('pointermove', function(e){
    if(!ptrs[e.pointerId]) return;
    var ks = Object.keys(ptrs);
    if(ks.length === 2){
      ptrs[e.pointerId] = [e.clientX, e.clientY]; var a = ptrs[ks[0]], b = ptrs[ks[1]], pd = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if(pinch0 > 0) cam.dist = Math.max(250, Math.min(16000, dist0 * pinch0 / pd));
      if(mid0) pan(mid[0] - mid0[0], mid[1] - mid0[1]); mid0 = mid; moved += 5;
    } else {
      var dx = e.clientX - last[0], dy = e.clientY - last[1]; moved += Math.abs(dx) + Math.abs(dy);
      if(e.buttons === 2 || e.shiftKey) pan(dx, dy); else { cam.theta -= dx * 0.005; cam.phi = Math.max(0.06, Math.min(1.45, cam.phi - dy * 0.005)); }
      last = [e.clientX, e.clientY]; ptrs[e.pointerId] = last;
    }
    anim = null; dirty = true;
  });
  function up(e){
    if(ptrs[e.pointerId] && moved < 6 && Object.keys(ptrs).length === 1) pick(e);
    delete ptrs[e.pointerId]; pinch0 = 0; mid0 = null;
  }
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', function(e){ e.preventDefault(); cam.dist = Math.max(250, Math.min(16000, cam.dist * (1 + e.deltaY * 0.0012))); anim = null; dirty = true; }, {passive:false});
  stage.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  stage.addEventListener('click', function(e){ var b = e.target.closest('button[data-act]'); if(!b) return; if(b.dataset.act === 'plan') setPlan(true); if(b.dataset.act === 'reset'){ setPlan(false); closeCard(); S.sel = null; renderBar(); } });
  barEl.addEventListener('click', onChip); floodEl.addEventListener('click', onChip); xEl.addEventListener('click', onChip);
  floodEl.addEventListener('input', function(e){ if(e.target.dataset.act === 'levelrange'){ S.level = parseFloat(e.target.value); applyStateCheap(); } });
  xEl.addEventListener('input', function(e){ if(e.target.dataset.act === 'xs'){ S.xs = parseInt(e.target.value, 10); var p = along(S.xs, 0); xsMarker.position.set(p[0], Y(trailZ(p[0], p[1]) + 2), -p[1]); xsMarker.rotation.y = -p[2]; var svg = xEl.querySelector('svg'); if(svg) svg.outerHTML = sectionSVG(); var lv = xEl.querySelector('.lv'); if(lv) lv.firstChild.textContent = (S.xs / 1609.34).toFixed(2) + ' mi from Waterfront Park South · '; dirty = true; } });
}
function applyStateCheap(){   /* the slider: move the water without rebuilding the bar */
  water.visible = S.level > 588.4; water.children.forEach(function(m){ var a = m.geometry.attributes.position; for(var v = 0; v < a.count; v++){ var x = a.getX(v), y = -a.getZ(v); a.setY(v, Y(levelZ(x, y))); } a.needsUpdate = true; });
  var lv = floodEl.querySelector('.lv'); if(lv) lv.innerHTML = 'Water surface <b>' + S.level.toFixed(1) + ' ft</b>, ' + Math.round((S.level - 588) * 12) + ' in above summer';
  floodEl.querySelectorAll('[data-act="level"]').forEach(function(b){ b.classList.toggle('on', Math.abs(parseFloat(b.dataset.val) - S.level) < 0.5); });
  if(S.section){ var svg = xEl.querySelector('svg'); if(svg) svg.outerHTML = sectionSVG(); }
  var l = LEVELS.filter(function(k){ return Math.abs(k[0] - S.level) < 0.5; })[0]; var hb = hud.querySelector('b:nth-of-type(2)'); if(hb) hb.textContent = Math.round(S.level) + '’';
  dirty = true;
}
function onChip(e){
  var b = e.target.closest('button[data-act]'); if(!b) return;
  var a = b.dataset.act, v = b.dataset.val;
  if(a === 'mode'){ S.mode = v; if(v === 'existing') S.sel = null; }
  else if(a === 'phase') S.phase = v;
  else if(a === 'xopt') S.xopt = v;
  else if(a === 'level') S.level = parseFloat(v);
  else if(a === 'fly'){ M.fly(v); return; }
  else if(a in S) S[a] = !S[a];
  if(a === 'floodLines') drawTexture();
  applyState();
}
function pan(dx, dy){
  var h = stage.clientHeight || 1, scale = 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / h;
  var fwd = new THREE.Vector3(-Math.sin(cam.theta), 0, -Math.cos(cam.theta)), right = new THREE.Vector3(Math.cos(cam.theta), 0, -Math.sin(cam.theta));
  cam.target.addScaledVector(right, -dx * scale).addScaledVector(fwd, dy * scale);
  var b = geo.box; cam.target.x = Math.max(b[0], Math.min(b[2], cam.target.x)); cam.target.z = Math.max(-b[3], Math.min(-b[1], cam.target.z));
}
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e){
  var r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  var hits = ray.intersectObjects(pickables, false);
  if(hits.length && groups.proposedMarks.visible){ openCard(hits[0].object.userData.focus); return; }
  closeCard();
}

/* ---------------------------------------------------------------- frame */
function resize(){
  var w = stage.clientWidth, h = stage.clientHeight; if(!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
}
var tmpV = new THREE.Vector3();
function frame(now){
  requestAnimationFrame(frame);
  if(anim){
    var t = Math.min(1, (now - anim.t0) / anim.dur), k = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    cam.target.lerpVectors(anim.from.target, anim.to.target, k); cam.dist = anim.from.dist + (anim.to.dist - anim.from.dist) * k; cam.phi = anim.from.phi + (anim.to.phi - anim.from.phi) * k; cam.theta = anim.from.theta + (anim.to.theta - anim.from.theta) * k;
    if(t >= 1) anim = null; dirty = true;
  }
  if(!dirty) return; dirty = false;
  camera.position.set(cam.target.x + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta), cam.target.y + cam.dist * Math.cos(cam.phi), cam.target.z + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
  camera.lookAt(cam.target); camera.updateMatrixWorld();
  renderer.render(scene, camera);
  /* labels */
  var w = stage.clientWidth, h = stage.clientHeight, far = cam.dist;
  labels.forEach(function(l){
    if(l.hidden || (l.cls === 'road' && far > 9000) || (l.cls === 'site' && far > 12000)){ l.el.style.display = 'none'; return; }
    tmpV.set(l.x, l.z, -l.y).project(camera);
    if(tmpV.z > 1 || tmpV.x < -1.05 || tmpV.x > 1.05 || tmpV.y < -1.05 || tmpV.y > 1.05){ l.el.style.display = 'none'; return; }
    l.el.style.display = ''; l.el.style.left = ((tmpV.x + 1) / 2 * w) + 'px'; l.el.style.top = ((1 - tmpV.y) / 2 * h) + 'px';
  });
  /* scale bar: 500 ft at the target distance */
  var sb = stage.querySelector('.scale'); if(sb){ var ppm = h / (2 * cam.dist * Math.tan(camera.fov * Math.PI / 360)); var px = 152.4 * ppm; if(px > 260){ px = 30.48 * ppm; sb.lastChild.textContent = '100 ft'; } else if(px < 40){ px = 304.8 * ppm; sb.lastChild.textContent = '1,000 ft'; } else sb.lastChild.textContent = '500 ft'; sb.firstChild.style.width = Math.round(px) + 'px'; }
  /* the study's icons keep a readable size: smaller as you come close */
  var ik = Math.max(28, Math.min(130, cam.dist * 0.03));
  groups.access.children.forEach(function(s){ s.scale.set(ik, ik, 1); s.position.y = s.userData.baseY + ik * 0.55; });
  /* the plan markers fade as you come close, so the drawn features show */
  var fo = Math.max(0.3, Math.min(1, (cam.dist - 600) / 1800));
  groups.proposedMarks.traverse(function(o){ if(o.isMesh && o.userData.fade) o.material.opacity = fo; });
  /* north arrow follows the azimuth */
  var na = stage.querySelector('.north'); if(na) na.style.transform = 'rotate(' + (cam.theta * 180 / Math.PI) + 'deg)';
}

/* ---------------------------------------------------------------- loading */
function load(){
  if(started) return; started = true;
  var loading = stage.querySelector('.loading');
  Promise.all([
    fetch('./data/imd-geo.json').then(function(r){ if(!r.ok) throw new Error('geo ' + r.status); return r.json(); }),
    new Promise(function(res, rej){ var im = new Image(); im.onload = function(){ res(im); }; im.onerror = rej; im.src = './data/imd-dem.png'; })
  ]).then(function(r){
    geo = r[0]; var im = r[1], g = geo.dem;
    var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    var px = cx.getImageData(0, 0, im.width, im.height).data, z = new Float32Array(g.nx * g.ny);
    for(var j = 0; j < g.ny; j++) for(var i = 0; i < g.nx; i++){ var r0 = (g.ny - 1 - j) * im.width + i; z[j * g.nx + i] = g.base + (px[r0 * 4] * 256 + px[r0 * 4 + 1]) * g.unit; }
    dem = {nx:g.nx, ny:g.ny, cell:g.cell, x0:g.x0, y0:g.y0, z:z};
    /* the fine cross-section profiles: base64 of little-endian uint16 decimetres above 170 m */
    if(geo.profiles && geo.profiles.b64){
      var pr = geo.profiles, bin = atob(pr.b64), rows = [];
      for(var rI = 0; rI < pr.rows; rI++){ var row = new Float32Array(pr.n); for(var k = 0; k < pr.n; k++){ var o = (rI * pr.n + k) * 2; row[k] = pr.base + (bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8)) * pr.unit; } rows.push(row); }
      pr.z = rows; delete pr.b64;
    }
    buildIMD(); build();
  }).catch(function(err){ console.warn('IMD model failed', err); if(loading) loading.textContent = 'The corridor model could not load. ' + (err.message || err); });
}
M.init = function(){
  stage = document.getElementById('imd-stage'); barEl = document.getElementById('imd-bar'); floodEl = document.getElementById('imd-flood'); xEl = document.getElementById('imd-xpanel');
  if(!stage || stage.dataset.bound) return; stage.dataset.bound = '1';
  /* the tab is usually hidden at load; build the model the first time the stage has a size */
  var kick = function(){ if(stage.clientWidth > 0 && stage.clientHeight > 0){ load(); return true; } return false; };
  if(!kick()){
    if(typeof ResizeObserver !== 'undefined'){ var ro = new ResizeObserver(function(){ if(kick()) ro.disconnect(); }); ro.observe(stage); }
    else window.addEventListener('hashchange', function(){ setTimeout(kick, 50); });
  }
};
function boot(){ M.init(); }
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
/* focus area text for the 3D cards comes from imd.js's data when present */
})();
