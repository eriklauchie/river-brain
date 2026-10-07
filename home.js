/* River Brain, simpler front page (Oct 2026).
   Home is Ask, four live readings and one door per part of the site. Each part
   opens on its own view (#now, #model, #life, #places, #facts, #learn), so the
   front page stays short and every link lands where it says.
   Also: the Log tab now reaches the Learning log, and the Greenway map is linked. */
(function(){
  'use strict';
  var body = document.body, main = document.querySelector('main');
  if(!main || body.classList.contains('rbv')) return;

  var VIEWS = ['home', 'now', 'model', 'life', 'places', 'facts', 'learn'];
  var ALIAS = {log:'learn', learning:'learn', reader:'learn', twin:'model', lifewidget:'life', gal:'life'};
  var MAP_URL = 'map.html';
  var MAP_KEY = 'rb-unlocked-v1';   // the Greenway map's remember-me key

  function icon(n){ return '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function count(sel){ return document.querySelectorAll(sel).length; }
  function openMap(){ try{ localStorage.setItem(MAP_KEY, '1'); }catch(_){} }

  /* 1. The Ask answers and the Learning log both used id="log", so the Log tab
        landed on the answers. The Learning log section gets its own id. */
  var dup = document.querySelectorAll('section#log');
  for(var i = 0; i < dup.length; i++) dup[i].id = 'learn';

  /* 2. Header: the logo goes home, Log points at the Learning log, Map opens the Greenway map */
  var nav = document.querySelector('header nav.tabs');
  var logo = document.querySelector('header .logo');
  if(logo){
    logo.setAttribute('role', 'link'); logo.setAttribute('tabindex', '0'); logo.title = 'River Brain home';
    logo.addEventListener('click', function(){ go('home'); });
    logo.addEventListener('keydown', function(e){ if(e.key === 'Enter') go('home'); });
  }
  var logTab = null;
  if(nav){
    logTab = nav.querySelector('a[href="#log"]');
    if(logTab) logTab.setAttribute('href', '#learn');
    var mapTab = document.createElement('a');
    mapTab.href = MAP_URL; mapTab.title = 'Grand River Greenway map';
    mapTab.innerHTML = icon('layers') + '<span>Map</span>';
    mapTab.addEventListener('click', openMap);
    nav.insertBefore(mapTab, logTab);
  }

  /* 3. Home: a link to all the readings, then one door per part of the site */
  var widgets = document.getElementById('widgets');
  if(widgets){
    var all = document.createElement('a');
    all.id = 'rb-allnow'; all.href = '#now';
    all.innerHTML = '<span>See all ' + (count('#widgets > .w') || 13) + ' readings</span>' + icon('chevron');
    widgets.parentNode.insertBefore(all, widgets.nextSibling);
  }

  var DOORS = [
    {to:'model',  ic:'cube',    t:'The river in 3D',      d:'Downtown from Ann St to Wealthy St on real coordinates, nine moments in time.'},
    {to:'life',   ic:'fish',    t:'Life in the river',    d:'<i data-n="#lf-strip > *">34</i> species, and who is active this month.'},
    {to:'places', ic:'map',     t:'Places on the river',  d:'<i data-n="#placelist > *">17</i> places along the water. Tap one to fly there in 3D.'},
    {to:'facts',  ic:'brain',   t:'Facts',                d:'<i data-n="#cards > *">31</i> facts on history, ecology and the restoration.'},
    {href:MAP_URL, ic:'layers', t:'Greenway map',         d:'The Grand River Greenway projects downtown, in 3D.'},
    {to:'learn',  ic:'history', t:'River Reader and log', d:'Andy Guy’s dispatches and what the brain learns each week.'}
  ];
  var doors = document.createElement('div');
  doors.id = 'rb-doors';
  doors.innerHTML = '<div class="sh"><h2>' + icon('sparkle') + ' Explore the river</h2></div><div class="rb-grid">' +
    DOORS.map(function(d){
      return '<a class="rb-door" href="' + (d.href || '#' + d.to) + '"' + (d.href ? ' data-map="1"' : '') + '>' +
             '<span class="rb-ic">' + icon(d.ic) + '</span><span><b>' + d.t + '</b><span>' + d.d + '</span></span></a>';
    }).join('') + '</div>';
  var nowSec = document.getElementById('now');
  main.insertBefore(doors, nowSec ? nowSec.nextSibling : null);
  doors.addEventListener('click', function(e){ if(e.target.closest('[data-map]')) openMap(); });
  function refreshCounts(){
    var ns = doors.querySelectorAll('i[data-n]');
    for(var i = 0; i < ns.length; i++){ var n = count(ns[i].getAttribute('data-n')); if(n) ns[i].textContent = n; }
  }

  /* 4. A way back home from every view */
  var back = document.createElement('a');
  back.id = 'rb-back'; back.href = '#';
  back.innerHTML = icon('back') + '<span>River Brain home</span>';
  back.addEventListener('click', function(e){ e.preventDefault(); go('home'); });
  main.insertBefore(back, main.firstChild);

  /* 5. Views, driven by the hash so links, Back and shared links all work */
  function viewOf(hash){
    var h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    if(!h || h === 'home') return 'home';
    if(VIEWS.indexOf(h) > -1) return h;
    if(ALIAS[h]) return ALIAS[h];
    var el = null; try{ el = document.getElementById(h); }catch(_){}
    var sec = el && el.closest ? el.closest('main > section') : null;
    if(sec) return sec.id === 'reader' ? 'learn' : (VIEWS.indexOf(sec.id) > -1 ? sec.id : 'home');
    return null;
  }
  function show(v, top){
    body.setAttribute('data-view', v);
    if(nav){
      var as = nav.querySelectorAll('a');
      for(var i = 0; i < as.length; i++) as[i].classList.toggle('on', as[i].getAttribute('href') === '#' + v);
    }
    if(top) window.scrollTo(0, 0);
    // the 3D stages size themselves with ResizeObserver; this nudge covers older browsers
    setTimeout(function(){ try{ window.dispatchEvent(new Event('resize')); }catch(_){} }, 60);
  }
  function go(v){
    if(v === 'home'){
      if(location.hash) history.pushState(null, '', location.pathname + location.search);
      show('home', true);
    } else if(location.hash !== '#' + v){
      location.hash = v;
    } else {
      show(v, true);
    }
  }
  function route(){
    var h = location.hash, key = h.replace(/^#/, ''), v = viewOf(h);
    if(v === null) return;
    var whole = !key || VIEWS.indexOf(key) > -1 || !!ALIAS[key];
    show(v, whole);
    if(!whole){
      var el = document.getElementById(decodeURIComponent(key));
      if(el) setTimeout(function(){ el.scrollIntoView({block:'center'}); }, 120);
    }
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);

  /* 6. Anything that scrolls to a part of the site (a place flying the 3D model,
        a reading's "go" button, a species link, a shared fact link) opens that view first */
  var siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function(){
    try{
      var sec = this.closest ? this.closest('main > section') : null;
      if(sec){
        var v = sec.id === 'reader' ? 'learn' : sec.id, cur = body.getAttribute('data-view');
        if(VIEWS.indexOf(v) > -1 && v !== cur && !(v === 'now' && cur === 'home')){
          history.pushState(null, '', '#' + v);
          show(v, false);
        }
      }
    }catch(_){}
    return siv.apply(this, arguments);
  };

  body.classList.add('rbv');
  var first = viewOf(location.hash);
  show(first === null ? 'home' : first, false);
  window.addEventListener('load', function(){ refreshCounts(); setTimeout(refreshCounts, 1500); });
})();
