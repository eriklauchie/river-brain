/* ============================================================================
   RIVER BRAIN: Grand River, Grand Rapids
   A standing reference + question-answering brain for the Grand River
   through Grand Rapids and the Grand River Revitalization Project.

   Architecture
   ------------
   KB          structured corpus. Every entry carries a reach tag, a confidence
               class and topic tags. Nothing in here is a live observation.
   retrieve()  keyword scoring over KB, so the model gets the relevant 6-8
               entries instead of the whole corpus on every question.
   ask()       Anthropic API + web_search. Live hydrology, closures, news and
               regulations are always fetched, never recalled.
   deepDive()  weekly research pass. Appends timestamped findings to storage.
               Never edits the base corpus.
   ============================================================================ */

/* inline icon from the symbol sheet in index.html */
const ic = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const MODEL = 'claude-sonnet-4-6';
const BASE_DATE = 'August 1, 2026';

/* ---------- confidence classes (from the operating manual) ---------- */
const CONF = {
  live:     ['OBSERVED_LIVE',    't-live',     'Measured right now'],
  official: ['OFFICIAL_CURRENT', 't-official', 'Current official position'],
  stable:   ['STABLE_FACT',      't-stable',   'Does not change'],
  seasonal: ['SEASONAL_LIKELY',  't-seasonal', 'Typical for the season'],
  planned:  ['PLANNED_FUTURE',   't-planned',  'Scheduled, not certain'],
  scenario: ['SCENARIO_ONLY',    't-scenario', 'Undecided, illustrative only']
};

const REACHES = {
  BASIN:      ['Basin',        'Whole watershed, about 5,572 sq mi'],
  MAINSTEM:   ['Mainstem GR',  'Grand River through Grand Rapids'],
  LOWER:      ['Lower Reach',  'Bridge Street to Fulton Street, active 2026-27 restoration'],
  UPPER:      ['Upper Reach',  'Ann Street to Bridge Street, Sixth Street Dam and federal EIS'],
  DOWNTOWN:   ['Downtown',     'Banks, floodwalls, bridges, parks, trails, public realm'],
  CORRIDOR:   ['Corridor',     'Grand Rapids area beyond downtown, verify locally']
};

/* ============================================================================
   THE CORPUS
   ========================================================================= */
const KB = [

/* ---------------------------------------------------------------- IDENTITY */
{
  id:'identity', t:'What the Grand actually is', f:['water','history'], reach:'BASIN', c:'stable',
  tags:'length miles watershed longest michigan source mouth hillsdale grand haven lake michigan tributaries owashtanong name',
  html:`<p>Michigan's longest river. It rises in Somerset Township, Hillsdale County, crosses the Lower Peninsula west, and reaches Lake Michigan at Grand Haven.</p>
  <dl class="kv">
    <dt>Length</dt><dd>252 miles by USGS National Hydrography Dataset. The City of Grand Rapids uses about 270. <strong>Say "roughly 250 to 270 miles"</strong> when you need to be unassailable.</dd>
    <dt>Watershed</dt><dd>About 5,572 square miles, Michigan's second largest.</dd>
    <dt>Discharge</dt><dd>Estimates vary by method: about 3,860 cfs in a mid-century USGS study, about 5,049 cfs in modern NHDPlus modelling. Neither is "today."</dd>
    <dt>Tributaries</dt><dd>Red Cedar, Looking Glass, Maple, Flat, Thornapple, Rogue, Portage, plus many smaller streams.</dd>
    <dt>Cities</dt><dd>Jackson, Eaton Rapids, Lansing, Grand Ledge, Portland, Ionia, Lowell, Grand Rapids, Grandville, Grand Haven.</dd>
    <dt>Odawa name</dt><dd>O-wash-ta-nong, "far-flowing water," for its length.</dd>
  </dl>
  <p>The name Grand Rapids preserves a real land-water relationship: limestone bedrock, ledges and coarse gravel once spread the river's drop across a broad noisy reach, roughly 18 feet over about a mile.</p>`
},
{
  id:'grammar', t:'Never say "the Grand River" as one place', f:['water'], reach:'BASIN', c:'stable',
  tags:'reach tag spatial grammar lower upper mainstem basin downtown corridor ambiguity',
  html:`<p>The single biggest source of wrong river information is geographic ambiguity. A fact true for the 5,572 square mile watershed can be false for the 2.5 mile downtown corridor.</p>
  <table><tr><th>Tag</th><th>Means</th></tr>
  <tr><td class="num">BASIN</td><td>Whole watershed. Climate, tributaries, land use, migration network.</td></tr>
  <tr><td class="num">MAINSTEM</td><td>The river through Grand Rapids. Flood stage, urban behaviour, general recreation.</td></tr>
  <tr><td class="num">LOWER REACH</td><td>Bridge Street to Fulton Street. The 2026-27 four-dam removal.</td></tr>
  <tr><td class="num">UPPER REACH</td><td>Ann Street to Bridge Street. Sixth Street Dam and the sea lamprey barrier EIS.</td></tr>
  <tr><td class="num">DOWNTOWN</td><td>Banks, floodwalls, bridges, parks, trails, events.</td></tr>
  <tr><td class="num">CORRIDOR</td><td>Grand Rapids area above and below downtown. Still needs local verification.</td></tr></table>
  <p><strong>Rule:</strong> attach a reach tag to every construction statement, wildlife claim, closure, hazard and rendering.</p>`
},

/* ------------------------------------------------------------------ WATER */
{
  id:'gauges', t:'Gauges, and the words people get wrong', f:['water'], reach:'MAINSTEM', c:'stable',
  tags:'usgs 04119000 04118564 gage height stage discharge cfs velocity depth deep how deep turbidity provisional nws gdrm4 measurement reading',
  html:`<dl class="kv">
    <dt>USGS 04119000</dt><dd>Grand River at Grand Rapids. Discharge and gage height.</dd>
    <dt>USGS 04118564</dt><dd>Grand River at North Park Street. Water temperature, dissolved oxygen, conductance, turbidity.</dd>
    <dt>NWS GDRM4</dt><dd>Flood thresholds, forecast, historic crests.</dd>
  </dl>
  <ul>
    <li><strong>Discharge (cfs)</strong> is a flow rate, not a current speed. The same cfs is slow in a wide pool and fast in a chute.</li>
    <li><strong>Gage height is not river depth.</strong> It is water surface elevation against a gauge datum. This is the single most common error.</li>
    <li><strong>Trend</strong> (rising, stable, falling) often matters more than the number.</li>
    <li>USGS live values are <strong>provisional</strong> and get revised.</li>
  </ul>
  <p>A dated example, not a normal: on July 26, 2026 the North Park station read about 25.3&nbsp;C / 77.5&nbsp;F, gage height 3.18 ft, conductance 625 µS/cm, dissolved oxygen 12.9 mg/L, turbidity about 3 FNU. Never replay that as today.</p>`
},
{
  id:'months', t:'The river year, month by month', f:['water','life'], reach:'MAINSTEM', c:'seasonal',
  tags:'temperature water temp month climate normals precipitation snow envelope seasonal typical air',
  html:`<p>Air normals are NWS 1991-2020. The water column is a <strong>simulation envelope</strong>, not a measured normal. Use it only when no live reading is available, and label it typical.</p>
  <table>
  <tr><th>Month</th><th>Air hi/lo F</th><th>Precip in</th><th>Snow in</th><th>Water</th><th>River expression</th></tr>
  <tr><td>Jan</td><td class="num">31.0 / 18.6</td><td class="num">2.52</td><td class="num">22.6</td><td class="num">0-4 C</td><td>Ice likely, low activity, thaw spikes stage fast</td></tr>
  <tr><td>Feb</td><td class="num">33.7 / 19.5</td><td class="num">2.12</td><td class="num">17.2</td><td class="num">0-4 C</td><td>Cold, ice, late-winter steelhead on warm spells</td></tr>
  <tr><td>Mar</td><td class="num">44.5 / 26.9</td><td class="num">2.39</td><td class="num">7.6</td><td class="num">2-7 C</td><td>Snowmelt variability, cold-water danger, flood vigilance</td></tr>
  <tr><td>Apr</td><td class="num">57.8 / 37.3</td><td class="num">3.99</td><td class="num">2.0</td><td class="num">7-13 C</td><td>Spawning and migration peak, rain turbidity</td></tr>
  <tr><td>May</td><td class="num">69.8 / 48.6</td><td class="num">4.00</td><td class="num">0</td><td class="num">13-19 C</td><td>Leaf-out, nursery period, recreation climbs</td></tr>
  <tr><td>Jun</td><td class="num">79.4 / 58.3</td><td class="num">3.94</td><td class="num">0</td><td class="num">18-23 C</td><td>Warmwater fish active, paddling, storm pulses</td></tr>
  <tr><td>Jul</td><td class="num">83.1 / 62.5</td><td class="num">3.86</td><td class="num">0</td><td class="num">22-27 C</td><td>Warmest water, thermal stress at low flow, peak construction</td></tr>
  <tr><td>Aug</td><td class="num">80.9 / 61.2</td><td class="num">3.55</td><td class="num">0</td><td class="num">22-27 C</td><td>Warm, low flow makes rock features legible</td></tr>
  <tr><td>Sep</td><td class="num">73.9 / 53.1</td><td class="num">3.43</td><td class="num">0</td><td class="num">18-23 C</td><td>Cooling begins, salmon strengthen, cleanup season</td></tr>
  <tr><td>Oct</td><td class="num">60.7 / 42.2</td><td class="num">4.02</td><td class="num">0.3</td><td class="num">10-17 C</td><td>Salmon and steelhead, leaf fall, frontal rain</td></tr>
  <tr><td>Nov</td><td class="num">47.2 / 32.8</td><td class="num">3.10</td><td class="num">7.1</td><td class="num">4-10 C</td><td>Fast cooling, steelhead, construction winds down</td></tr>
  <tr><td>Dec</td><td class="num">36.1 / 24.7</td><td class="num">2.48</td><td class="num">20.8</td><td class="num">0-5 C</td><td>Snow and ice return, ice-jam scenarios</td></tr>
  </table>
  <p>Annual normals: about 39.40 in precipitation, 77.6 in snowfall. In Fahrenheit the water runs roughly 32-38 in winter, 38-62 through spring, 65-76 in summer, 40-68 falling through autumn.</p>
  <p><strong>Air temperature is not a proxy for water temperature.</strong> A sunny 65 F April afternoon sits over water that will still kill you.</p>`
},
{
  id:'flow', t:'Flow, ice and the shape of the year', f:['water'], reach:'MAINSTEM', c:'seasonal',
  tags:'flow discharge seasonal high low spring snowmelt ice jam breakup portland comstock park robinson dynamite safe safety wade wading swim paddle current danger',
  html:`<p>High flows peak March and April on snowmelt, often above 7,000 cfs near Grand Rapids, with a secondary fall rain peak. Lows dominate August and September, frequently under 2,000 cfs. Late July 2026 sat near <strong>1,300 cfs at about 72 F</strong>, described by the Grand River Network as well below the seasonal average.</p>
  <p><strong>Ice.</strong> In early February 2026 the NWS reported the river roughly 98 percent frozen from Hillsdale County to Lake Michigan, among the thickest coverage in recent years. Thick ice raises jam risk on thaw. Recurring jam points: Portland, Comstock Park, Robinson Township. A 2019 Portland jam forced evacuations with about $1.6M damage to one owner. Grand Rapids historically dynamited jams; modern practice favours tension weirs and ice-control structures.</p>
  <p><strong>Simulation note:</strong> do not freeze the river uniformly. Shallow slack edges freeze first, faster water stays open, and thaw puts ice in motion.</p>`
},
{
  id:'flood', t:'Flood behaviour and the crest table', f:['water','history'], reach:'MAINSTEM', c:'official',
  tags:'flood stage crest 2013 1904 1985 2018 bankfull major moderate fema floodwall record 21.85',
  html:`<p>NWS GDRM4 thresholds: <strong>12 ft bankfull, 18 ft flood, 21 ft moderate, 23 ft major.</strong> Live-check, because rating curves change.</p>
  <table><tr><th>Date</th><th>Crest</th><th>Why it matters</th></tr>
  <tr><td>Apr 21, 2013</td><td class="num">21.85 ft</td><td>Record stage. ~700 evacuated in Kent County, ~1,000 from Plaza Towers, over $10M damage, no deaths</td></tr>
  <tr><td>Feb 25, 2018</td><td class="num">20.67 ft</td><td>Second highest modern crest</td></tr>
  <tr><td>Mar 1, 1985</td><td class="num">19.64 ft</td><td>Previous record, broken in 2013</td></tr>
  <tr><td>May 2020</td><td class="num">19.55 ft</td><td>Recent high water</td></tr>
  <tr><td>1904</td><td class="num">~19.5-20.4 ft</td><td>Largest by volume, about 54,000 cfs. Sources differ by gauge datum</td></tr>
  <tr><td>Apr 8, 2023</td><td class="num">18.86 ft</td><td>Recent flood-stage event</td></tr></table>
  <p>By <em>volume</em> the ranking is 1904 &gt; 1905 &gt; 1948 &gt; 1947 &gt; 2013. By <em>stage</em> 2013 is the record. Earliest recorded flood: 1832. The 1904 flood prompted the floodwalls begun in 1911.</p>
  <p><strong>Never say restoration stops flooding.</strong> FEMA's conditional review and the NRCS analysis found the Lower Reach design is not expected to increase mapped flood risk. That is the correct sentence. Flood risk remains.</p>`
},
{
  id:'quality', t:'Water quality: sewage conduit to recovering river', f:['water','history'], reach:'MAINSTEM', c:'official',
  tags:'cso sewage 12.6 billion gallons 1969 sewer improvement 400 million 59 outfalls 2015 pfas eat safe fish ecoli',
  html:`<p>In 1969 as much as <strong>12.6 billion gallons of raw sewage</strong> entered the Grand in a single year. Beginning 1991 the City ran a roughly <strong>$400 million</strong> sewer improvement programme: <strong>59 combined sewer overflow outfalls eliminated</strong>, about 119 miles of new pipe, a 30-million-gallon retention basin. The last outfall was sealed <strong>July 13, 2015</strong> at Washington and Lafayette, more than three years ahead of the state's 2019 mandate. Pre-programme overflows averaged about 10 billion gallons a year. Now zero through those points. Ratepayers finance it through 2042. The treatment plant itself dates to 1931.</p>
  <p><strong>Still reaching the river:</strong> urban stormwater sediment and road grit, nutrients, bacteria, chloride from road salt, and legacy contaminants.</p>
  <p><strong>PFAS.</strong> MDHHS tightened Eat Safe Fish thresholds sharply in 2024-25: the Do Not Eat trigger fell from 300 ppb to about 49.6 ppb, and the limitation trigger from 9 ppb to 1.5 ppb. Advisories are <strong>species and reach specific</strong>. Never give eating advice from memory; send people to the current MDHHS guide.</p>
  <p><strong>Brown water is not automatically a spill.</strong> Turbidity has many causes: storms, bank erosion, bed disturbance, construction. Check monitoring and official incident reports before naming pollution.</p>`
},

/* ------------------------------------------------------------------- LIFE */
{
  id:'fish', t:'Fish, by guild not by wishlist', f:['life'], reach:'MAINSTEM', c:'seasonal',
  tags:'fish species steelhead chinook coho salmon walleye smallmouth bass catfish pike sucker redhorse sturgeon guild 107',
  html:`<p>The 2011 DNR Grand River Assessment records <strong>107 fish species</strong> in the watershed, 14 of them introduced. State listed: lake sturgeon, river redhorse and cisco are threatened; pugnose shiner is endangered. Two are extirpated: weed shiner (last reported 1941) and American eel.</p>
  <table><tr><th>Species</th><th>When and where</th></tr>
  <tr><td>Steelhead</td><td>Fall through spring. Introduced Great Lakes migrant, the biggest angling draw</td></tr>
  <tr><td>Chinook salmon</td><td>Late summer into fall migration and spawning</td></tr>
  <tr><td>Coho salmon</td><td>Fall. Do not assume Chinook timing or abundance</td></tr>
  <tr><td>Walleye</td><td>Year-round river use, spring spawning movements below dams</td></tr>
  <tr><td>Smallmouth bass</td><td>Warm season, around rock and current breaks. New boulders add habitat</td></tr>
  <tr><td>Largemouth, sunfish, rock bass</td><td>Slower margins and backwaters, not fast mid-channel</td></tr>
  <tr><td>Channel and flathead catfish</td><td>Warm-season feeding, deeper slower zones</td></tr>
  <tr><td>Northern pike</td><td>Slower vegetated habitat in the wider system</td></tr>
  <tr><td>White sucker, redhorse</td><td>Strong spring movement over gravel. Ecologically important migrants</td></tr>
  <tr><td>Lake sturgeon</td><td>Rare. State threatened since 1994. Spring spawning window. Never call it common downtown</td></tr></table>
  <p><strong>Sturgeon population:</strong> LGROW estimates about 100 individuals. Juveniles were confirmed September 8, 2022, proving the river reproduces its own. The GRPM, John Ball Zoo, GVSU and Encompass team hold a USFWS grant of nearly $150,000.</p>
  <p><strong>Say this:</strong> "Cooling fall water increases the likelihood of Chinook, coho and steelhead movement." <strong>Not this:</strong> "There are hundreds of salmon jumping here today." The second needs eyes on the water.</p>`
},
{
  id:'fishing', t:'Fishing calendar and access', f:['life','people'], reach:'MAINSTEM', c:'seasonal',
  tags:'fishing calendar season salmon run steelhead walleye access sixth street fish ladder brenke license dnr regulations wade wading angler catch',
  html:`<table><tr><th>Season</th><th>Target</th></tr>
  <tr><td>Mar-May</td><td>Steelhead spawning run peak, walleye below dams, suckers</td></tr>
  <tr><td>Jun-Aug</td><td>Smallmouth, channel and flathead catfish, pike, panfish, carp and bowfishing</td></tr>
  <tr><td>Sep-Nov</td><td>Chinook and coho, fall steelhead, lake-run browns, walleye</td></tr>
  <tr><td>Dec-Feb</td><td>Holdover steelhead, walleye</td></tr></table>
  <p><strong>Timing detail.</strong> Chinook enter late August as water cools; coho follow weeks later and peak mid-to-late September on Webber Dam data. MSU Extension gives 57-61 F as optimum Chinook migration temperature. Steelhead: run starts late September to early October, peaks November, holds through winter, then a large push late February through April with early March often biggest. Skamania summer-runs appear late May into early summer.</p>
  <p><strong>Access.</strong> Grand Rapids: Sixth Street Dam and Fish Ladder Park on the west bank (built 1974, designed by artist Joseph Kinnebrew). No fishing inside the ladder itself. Lansing: Brenke Fish Ladder in Old Town, built 1981, the sixth in a series letting fish migrate 184 miles from Lake Michigan to Moores Park Dam. Also Portland, Ionia, Lyons, and the Grand Haven pier and channel.</p>
  <p><strong>Lake sturgeon may not be targeted here.</strong> Release immediately if caught incidentally. Catch-and-release is closed statewide through July 15, opens July 16 on most waters; harvest remains illegal except in a few designated waters. Michigan licence required. DNR 2026 regulations run through March 31, 2027. <strong>Live-check before giving anyone legal advice.</strong></p>
  <p>Dam removal will disperse the concentrated downtown fishery. Scout new stacking points once the Lower Reach is finished.</p>`
},
{
  id:'mussels', t:'Mussels: the river\u2019s slow infrastructure', f:['life','build'], reach:'LOWER', c:'official',
  tags:'mussel snuffbox relocation 9040 45000 square meters endangered biological opinion knapp street unionid zebra',
  html:`<p>Mussels live in and on the bed. They filter water, cycle nutrients and shape microhabitat, and they cannot move out of the way of an excavator. Many native species need a specific host fish for their larvae, which ties fish passage directly to mussel population connectivity.</p>
  <p>The 2024 Lower Reach survey covered about <strong>45,000 square metres</strong>, roughly eight football fields, and relocated <strong>9,040 mussels</strong>: 6,933 common, 2,069 state listed, and <strong>38 federally endangered snuffbox</strong>. Crews estimated 14,000-15,000 total in the project area. Work ran August 23 to September 13, 2024. The USFWS Biological Opinion of August 14, 2024 found the project not likely to jeopardise the snuffbox with required conservation measures. FEMA issued its Conditional Letter of Map Revision December 11, 2024.</p>
  <p>A second relocation happened below the <strong>Knapp Street bridge in July 2026</strong>, same reason: bridge work over occupied bed.</p>
  <ul>
    <li>Do not animate native mussels swimming around. They are a bed layer tied to substrate, depth, velocity and host access.</li>
    <li>Disturbance is instant. Recovery is measured in <strong>years</strong>.</li>
    <li>A good-looking new riffle is not proof the mussel community came back.</li>
    <li>Native unionids are not zebra mussels. Do not blur them.</li>
  </ul>`
},
{
  id:'benthos', t:'Why rock matters: riffle mechanics', f:['life'], reach:'LOWER', c:'stable',
  tags:'benthic algae periphyton insect larvae crayfish oxygen aeration boundary layer shear riffle food web',
  html:`<p>Rock habitat is food-web structure. Periphyton, algae and biofilms colonise boulders and cobble. Insect larvae live between stones. Crayfish use crevices. Small fish feed along seams; big fish use those concentrations.</p>
  <p>A restored rough channel changes boundary layers, shear stress, oxygen exchange, sediment pockets, light and hiding places, not just the look of the water.</p>
  <p>NRCS expects increased turbulence <strong>may improve local dissolved oxygen</strong>, especially at low summer flow. Say "may improve local mixing and aeration." Do not promise an oxygen increase: DO also depends on temperature, organic demand and photosynthesis.</p>`
},
{
  id:'wildlife', t:'Birds, mammals, reptiles, amphibians', f:['life'], reach:'CORRIDOR', c:'seasonal',
  tags:'birds eagle heron otter mink beaver muskrat turtle frog migratory bobolink wood thrush',
  html:`<p>The federal review named migratory birds with potential occurrence: bald eagle, black-billed cuckoo, bobolink, golden-winged warbler, lesser yellowlegs, red-headed woodpecker, rusty blackbird, semipalmated sandpiper, willow flycatcher, wood thrush.</p>
  <p><strong>"Potential occurrence" is not "standing downtown right now."</strong> Treat as a regional seasonal possibility layer unless someone actually saw it.</p>
  <ul>
    <li>Great blue herons and other fish-eaters favour shallows and slow edges.</li>
    <li>Bald eagles use open-water reaches as feeding and travel corridors.</li>
    <li>Mink and river otter are plausible in the wider system; downtown presence should be observation based.</li>
    <li>Turtles and frogs need soft banks, wetlands, backwaters and tributary mouths, not hard floodwall edge.</li>
    <li>Spring and fall migration produce short diversity peaks.</li>
  </ul>
  <p>Corridor mammals include beaver, river otter, mink, muskrat, white-tailed deer. Turtles include spiny softshell, northern map, Blanding's, painted and snapping. The mudpuppy matters because it hosts the salamander mussel.</p>`
},
{
  id:'invasive', t:'Invasives and the barrier problem', f:['life','build'], reach:'UPPER', c:'official',
  tags:'sea lamprey invasive zebra mussel round goby phragmites purple loosestrife frogbit barrier glfc',
  html:`<p>Sea lamprey are invasive parasites that damage Great Lakes fish populations. <strong>Sixth Street Dam is currently the first major barrier in this reach.</strong> That is why the Upper Reach cannot simply repeat the Lower Reach dam-removal approach: it must remove an aging hazardous structure <em>and</em> keep an effective lamprey barrier.</p>
  <p>Named in the DNR assessment: common carp, round goby, sea lamprey, zebra mussel, curly-leaf pondweed, Eurasian watermilfoil. In floodplain and bank habitat: emerald ash borer, Dutch elm disease, garlic mustard, phragmites, purple loosestrife. European frogbit is an emerging aquatic invasive under management in the lower river.</p>
  <p><strong>Watch out:</strong> rusty crayfish figures that circulate online usually belong to the <em>Ontario</em> Grand River, a different river with the same name. Same trap applies to some mussel abundance numbers.</p>
  <p><strong>Rule:</strong> never optimise a future Sixth Street design for human recreation alone. Lamprey control is a governing Great Lakes fisheries requirement.</p>`
},

/* --------------------------------------------------------------- HISTORY */
{
  id:'indigenous', t:'Indigenous presence, past and present tense', f:['history','people'], reach:'BASIN', c:'stable',
  tags:'odawa anishinaabe ottawa treaty grand river bands homecoming three fires mounds hopewell',
  html:`<p>Indigenous presence <strong>predates and continues beyond</strong> settlement. Write it in the present tense where it is present tense.</p>
  <ul>
    <li>Hopewell burial mounds along the river are roughly 2,000 years old. Norton Mounds is a National Historic Landmark.</li>
    <li>Nineteen Ottawa chiefs governed lands from Lake Michigan to Lansing, main village at what is now downtown Grand Rapids.</li>
    <li>The 1821 Treaty of Chicago and later treaty relationships remain live political and cultural context.</li>
    <li>The Grand River Bands of Ottawa Indians are a current community, not a historical footnote.</li>
    <li>Homecoming of the Three Fires is a recurring June gathering at Riverside Park.</li>
  </ul>
  <p>Indigenous history here is present tense, not a chapter that ends in 1826. Industrial history is best read as intention versus impact rather than a search for villains.</p>`
},
{
  id:'industrial', t:'Dams, canals, power and the engineered channel', f:['history','build'], reach:'MAINSTEM', c:'stable',
  tags:'campau 1826 sixth street dam canal 1849 electricity 1880 low head dams 1920s floodwall bridges gypsum dredging 300000',
  html:`<ul>
    <li><strong>1826</strong> Louis Campau establishes a trading post at the rapids.</li>
    <li><strong>1841</strong> Gypsum mining begins near Plaster Creek. Grand Rapids sits on one of North America's richest gypsum formations, with up to six miles of tunnels 85-100 ft below the city. Later reused for mushroom farming, records storage, a data centre and beer storage.</li>
    <li><strong>1849-1860s</strong> Sixth Street Dam and the mill canals build an industrial water-power system.</li>
    <li><strong>July 26, 1880</strong> River water power generates electric lighting, which the local historical commission identifies as a national first.</li>
    <li><strong>1883</strong> The Great Log Jam.</li>
    <li><strong>1920s-1931</strong> Four downstream low-head dams installed. These are the ones now being removed.</li>
    <li><strong>1911 onward</strong> Floodwalls begun after 1904.</li>
  </ul>
  <p>The NRCS assessment records roughly <strong>300,000 cubic yards</strong> of gravel, cobble and boulder historically dredged out and used as riverfront fill. That is why restoration is not "uncovering a hidden pristine river." It is designing a new stable urban channel that recovers some rapids function using rock, while protecting bridges, flood conveyance and utilities.</p>`
},
{
  id:'logjam', t:'The Great Log Jam of 1883', f:['history'], reach:'MAINSTEM', c:'stable',
  tags:'log jam 1883 logs board feet bridges john walsh white friant lumber',
  html:`<p>On the morning of <strong>July 26, 1883</strong>, after two weeks of record rain, a roughly seven-mile jam above the Grand Trunk Railroad Bridge broke loose. Over <strong>600,000 logs, about 150 million board feet</strong>, tore out every railroad bridge in the city. Stewart Edward White later estimated the mass at 37 million tons.</p>
  <p>Lumberjacks at Grand Haven reinforced booms and stopped the logs short of Lake Michigan. Captain John Walsh, a one-armed pile-driver operator born in Canada in 1838, was credited with driving the pilings that halted the jam and saved the timber. His employers gave him a gold watch. No lives lost. Damages over $500,000, roughly $15M today. Within a few years the local lumber era was over.</p>
  <p>Earlier: log booms were run by firms like White &amp; Friant, who controlled river traffic from about 1866 to 1889. Steamboat service to Grand Haven began in the early 1830s; the first, the <em>Governor Mason</em> (1837), had no whistle, so a bugler announced arrivals. The second, the <em>Owashtanong</em>, reportedly carried the first steamboat whistle made west of Detroit.</p>`
},
{
  id:'timeline', t:'Full timeline', f:['history','build'], reach:'MAINSTEM', c:'stable',
  tags:'timeline chronology dates history milestones',
  html:`<table><tr><th>When</th><th>What</th></tr>
  <tr><td class="num">Millennia</td><td>Indigenous people live, travel, fish and gather in the valley</td></tr>
  <tr><td class="num">1826</td><td>Louis Campau trading post</td></tr>
  <tr><td class="num">1832</td><td>Earliest recorded local flood</td></tr>
  <tr><td class="num">1838</td><td>Ice-jam flood, ice piled 20-30 ft high, river forced into a new channel. First Grand Haven lighthouse</td></tr>
  <tr><td class="num">1841</td><td>Gypsum mining begins</td></tr>
  <tr><td class="num">1849-60s</td><td>Sixth Street Dam and canals</td></tr>
  <tr><td class="num">1850</td><td>Grand Rapids incorporated</td></tr>
  <tr><td class="num">1859</td><td>Grand Haven south pier construction begins</td></tr>
  <tr><td class="num">Jul 26, 1880</td><td>Water power generates electric lighting</td></tr>
  <tr><td class="num">Jul 26, 1883</td><td>Great Log Jam</td></tr>
  <tr><td class="num">1886 / 1892 / 1915</td><td>Sixth Street Bridge; Blue Bridge span (575 ft); Gillett Bridge</td></tr>
  <tr><td class="num">1904</td><td>Largest flood by volume, ~54,000 cfs</td></tr>
  <tr><td class="num">1911</td><td>Floodwalls begun</td></tr>
  <tr><td class="num">1920s-31</td><td>Four low-head dams installed. Wastewater treatment era begins 1931</td></tr>
  <tr><td class="num">1962</td><td>Grand Haven Musical Fountain built</td></tr>
  <tr><td class="num">1969</td><td>12.6 billion gallons of raw sewage in one year</td></tr>
  <tr><td class="num">1974 / 1981</td><td>Grand Rapids fish ladder; Brenke Fish Ladder, Lansing</td></tr>
  <tr><td class="num">1985</td><td>Crest 19.64 ft</td></tr>
  <tr><td class="num">1990 / 2000 / 2010</td><td>Grand River Expedition, source to mouth</td></tr>
  <tr><td class="num">1991</td><td>Sewer improvement and CSO elimination begins</td></tr>
  <tr><td class="num">2009</td><td>Grand Rapids WhiteWater organises. ArtPrize begins</td></tr>
  <tr><td class="num">Apr 21, 2013</td><td>Record crest 21.85 ft</td></tr>
  <tr><td class="num">Jul 13, 2015</td><td>Final CSO outfall sealed</td></tr>
  <tr><td class="num">Feb 25, 2018</td><td>Crest 20.67 ft</td></tr>
  <tr><td class="num">Sep 8, 2022</td><td>Juvenile sturgeon confirmed: the river is reproducing them</td></tr>
  <tr><td class="num">Aug-Sep 2024</td><td>Lower Reach mussel relocation, 9,040 moved</td></tr>
  <tr><td class="num">Jun 23, 2025</td><td>EGLE final Lower Reach permit</td></tr>
  <tr><td class="num">Aug 2025</td><td>City adopts Climate Action and Adaptation Plan</td></tr>
  <tr><td class="num">Jan 2026</td><td>NRCS Final EA and FONSI</td></tr>
  <tr><td class="num">Feb 25, 2026</td><td>City awards Lower Reach construction contract</td></tr>
  <tr><td class="num">Mar 23, 2026</td><td>Federal funding approval announced</td></tr>
  <tr><td class="num">May 15, 2026</td><td>Acrisure Amphitheater opens, Lionel Richie</td></tr>
  <tr><td class="num">May 18, 2026</td><td>Ah-Nab-Awen mobilisation begins</td></tr>
  <tr><td class="num">Jun 1, 2026</td><td>Lower Reach groundbreaking</td></tr>
  <tr><td class="num">Jul 1, 2026</td><td>In-river work permitted to begin</td></tr>
  <tr><td class="num">Jul 2027</td><td>Upper Reach Draft EIS anticipated</td></tr>
  <tr><td class="num">Fall 2027</td><td>Lower Reach expected completion, water and weather dependent</td></tr></table>`
},
{
  id:'grandhaven', t:'The mouth: Grand Haven', f:['history','people'], reach:'CORRIDOR', c:'stable',
  tags:'grand haven lighthouse pier coast guard city musical fountain dewey hill harbour',
  html:`<p>Congress funded a lighthouse at the river mouth in 1837; the first, a stone dwelling, went up in 1838. Erosion forced reconstruction on higher ground in 1855. The Detroit &amp; Milwaukee Railroad began the south pier in 1859 to protect its cross-lake ferries. The south pier now runs over 1,400 ft; the inner light dates to 1905, the 1904 outer light was moved back 600 ft in 1907. The two red lights are joined by a catwalk. The Coast Guard stopped maintaining them in 2009; the City owns them and the Grand Haven Lighthouse Conservancy maintains them.</p>
  <p>Grand Haven is <strong>Coast Guard City, USA</strong> by Act of Congress, November 13, 1998.</p>`
},

/* --------------------------------------------------------- CONSTRUCTION */
{
  id:'lower', t:'Lower Reach: what is happening in the water', f:['build'], reach:'LOWER', c:'official',
  tags:'lower reach construction building taplin 14562625 25982101 nrcs mobilization july 1 cofferdam causeway boulder arch riffle j-hook dam removal four dams progress',
  html:`<p>Between <strong>Bridge Street and Fulton Street</strong>. Four low-head dams removed. The drop is redistributed across <strong>two channel-wide rock grade-control structures</strong>, constructed riffles, bed grading, <strong>125+ habitat boulders</strong> and <strong>three edge / J-hook structures</strong>.</p>
  <dl class="kv">
    <dt>Contractor</dt><dd>Taplin, awarded $14,562,625.98 by City Commission, late February 2026 (reported Feb 24-25)</dd>
    <dt>Ceiling</dt><dd>Total authorised expenditure not to exceed about $25,982,101</dd>
    <dt>Federal</dt><dd>$11,026,695 NRCS</dd>
    <dt>Staging</dt><dd>Ah-Nab-Awen Park. Mobilisation May 18, 2026</dd>
    <dt>In-river</dt><dd>Not before July 1, 2026, so Sixth Street keeps working as a lamprey barrier through the control period</dd>
    <dt>Duration</dt><dd>Two construction seasons with a winter pause. Expected complete fall 2027</dd>
    <dt>Footprint</dt><dd>~31.5 acres construction area, ~11.7 acres direct impact, ~6.1 acres permanent riverbed alteration</dd>
  </dl>
  <table><tr><th>Feature</th><th>Action</th></tr>
  <tr><td>Dam 4, near Bridge</td><td>Remove, grade bed upstream</td></tr>
  <tr><td>Bridge to Gillett</td><td>Bed grading, scattered habitat boulders</td></tr>
  <tr><td>Dam 3, below Bridge</td><td>Remove</td></tr>
  <tr><td>Dam 2, above Gillett</td><td>Remove; three boulder arches and constructed riffles. Main grade-control zone</td></tr>
  <tr><td>Dam 1, above Pearl</td><td>Remove; constructed riffle and habitat boulders</td></tr>
  <tr><td>Pearl to Fulton</td><td>Habitat boulders, bank vane and J-hook edge features</td></tr></table>
  <p><strong>Not in the design any more:</strong> purpose-built standing whitewater surf waves. Natural rough water may form around rock at some discharges. Do not render a permanent surf wave.</p>`
},
{
  id:'onsite', t:'What you will see and hear at the construction site', f:['build'], reach:'LOWER', c:'seasonal',
  tags:'construction site visual sound excavator causeway turbidity plume closures what does it look like',
  html:`<p><strong>See:</strong> excavators and loaders working off temporary rock causeways; dump trucks and rock delivery; boulder and stone stockpiles; localised cofferdam or isolated work zones; hi-vis PPE; fencing and park closures; flow squeezed around temporary access paths; sediment plumes during active bed disturbance; finished rock features appearing section by section.</p>
  <p><strong>Hear:</strong> diesel equipment, backup alarms, rock impact and placement, trucks on the riverfront, radio comms, and the river's own sound changing as new rough-water features come alive.</p>
  <p><strong>Access:</strong> the work zone between Bridge Street and Fulton Street is closed to the public, on the water and on the bank paths inside the fencing. The bridges stay open, and they are the best viewpoints. Rain does not automatically stop work.</p>
  <p><strong>Turbidity is not pollution.</strong> A brown plume below the work is construction sediment under monitoring, not a spill.</p>`
},
{
  id:'matrix', t:'Before, during, after', f:['build'], reach:'LOWER', c:'planned',
  tags:'before during after matrix hydraulics safety passage recreation sound visual discharge low moderate high',
  html:`<table><tr><th>System</th><th>Before</th><th>During</th><th>Expected after</th></tr>
  <tr><td>Hydraulics</td><td>Four uniform drops, pooled backwater</td><td>Causeways redirect local flow</td><td>Distributed grade control, riffles, velocity diversity</td></tr>
  <tr><td>Safety</td><td>Recirculating low-head rollers</td><td>Work-zone exclusions</td><td>Rollers gone. Current, rock, cold and high water still dangerous</td></tr>
  <tr><td>Fish passage</td><td>Four barriers Fulton to Bridge</td><td>Temporary disturbance</td><td>Improved passage Fulton toward Sixth Street</td></tr>
  <tr><td>Mussels</td><td>Existing bed community</td><td>Relocation, sediment control</td><td>Multi-year recolonisation</td></tr>
  <tr><td>Look</td><td>Smooth sheets cut by straight dam lines</td><td>Industrial landscape</td><td>Irregular rock and riffle texture, broken water</td></tr>
  <tr><td>Sound</td><td>Traffic plus concentrated drops</td><td>Equipment and rock placement</td><td>Distributed river sound across rough water</td></tr>
  <tr><td>Recreation</td><td>Dam and bank constraints</td><td>Reduced access</td><td>More varied fishing, wading, paddling. Flow dependent</td></tr></table>
  <p><strong>How it looks by discharge.</strong> Low: rock tops and boulder fields exposed, small fast tongues, individual riffles legible. Moderate: strongest rapids readability, whitewater lines, boulder wakes, seams and eddies distinct. High: rocks submerge, river reads broad and continuous, rough water increases but geometry hides. Flood: do not glamorise. Model volume, debris, pier turbulence, inundated edges and closures.</p>`
},
{
  id:'upper', t:'Upper Reach: a decision tree, not a plan', f:['build'], reach:'UPPER', c:'scenario',
  tags:'upper reach sixth street dam removed removal eis glfc army corps alternatives draft eis july 2027 20 million barrier lamprey future decision',
  html:`<p><strong>Ann Street to Bridge Street.</strong> The Great Lakes Fishery Commission leads a federal Environmental Impact Statement with the US Army Corps of Engineers. The EIS resumed in spring 2026; scoping included an April 22 meeting with comments closing May 22.</p>
  <p>Alternatives on the table:</p>
  <ol><li>No action</li><li>Fixed barrier at the present Sixth Street location</li><li>Adjustable barrier at the present location</li><li>Fixed barrier about half a mile upstream</li><li>Adjustable barrier about half a mile upstream</li><li>Fixed barrier about a mile upstream</li><li>Adjustable barrier about a mile upstream</li></ol>
  <p><strong>Draft EIS anticipated July 2027.</strong> Over $20 million in federal funding is identified for a new lamprey barrier, but no alternative and no construction schedule are selected.</p>
  <p><strong>Do not render as fact:</strong> Sixth Street Dam already removed; a specific barrier already chosen; an upstream location finalised; a construction start year; uninterrupted fish passage through the lamprey control point. Any of those is a labelled SCENARIO only.</p>`
},
{
  id:'climate', t:'Climate: a wider operating envelope', f:['water','build'], reach:'BASIN', c:'planned',
  tags:'climate change projection warming precipitation variability drought flood mid-century',
  html:`<p>City projections: average air temperature about <strong>3-5 F warmer by mid-century</strong>, summers 4-7 F warmer, days above 90 F rising from about 7.9 a year historically to roughly 20-38, annual precipitation already up about 16 percent, potentially up another 3 inches by mid-century, more winter precipitation falling as rain, and the heaviest 1 percent of events producing substantially more rain.</p>
  <table><tr><th>Signal</th><th>River response</th></tr>
  <tr><td>Hotter summers</td><td>Longer warm-water windows, thermal stress, human heat exposure</td></tr>
  <tr><td>More intense rain</td><td>Sharper discharge, turbidity and debris pulses</td></tr>
  <tr><td>More winter rain</td><td>More rain-on-snow high-water scenarios</td></tr>
  <tr><td>Variable freeze/thaw</td><td>Less continuous ice does not remove moving-ice or jam hazard</td></tr>
  <tr><td>Dry summer spells</td><td>Lower base flow, warmer water, less cool refuge</td></tr>
  <tr><td>Shifted thermal seasons</td><td>Migration and spawning timing moves rather than following a date</td></tr></table>
  <p>The concept is <strong>greater variability</strong>, not "the river only gets higher." Projections are long-term distributions. They never predict a specific future Tuesday.</p>`
},

/* --------------------------------------------------------- PEOPLE / EVENTS */
{
  id:'events', t:'Annual events versus one-offs', f:['people'], reach:'DOWNTOWN', c:'official',
  tags:'events annual calendar coast guard festival cleanup world of winter artprize dam jam regatta expedition paddlefest happening this month upcoming when',
  html:`<p><strong>Confirmed annual.</strong></p>
  <table><tr><th>Event</th><th>When</th><th>Note</th></tr>
  <tr><td>Grand Regatta</td><td>June</td><td>Grand Rapids Rowing. June 13, 2026, 1,000 m sprint, Michigan State Games</td></tr>
  <tr><td>Homecoming of the Three Fires</td><td>June</td><td>June 13-14, 2026, Riverside Park</td></tr>
  <tr><td>Summer Science &amp; Leadership</td><td>July</td><td>July 6-17, 2026. Students study sturgeon, mussels, aquatic ecology</td></tr>
  <tr><td>Grand Haven Coast Guard Festival</td><td>Late Jul to early Aug</td><td>10 days around Coast Guard Day. Founded 1924, first festival 1937. 350,000+ attend</td></tr>
  <tr><td>GRPM Grand River Adventure</td><td>Mid-August</td><td>Aug 15, 2026, 4th annual</td></tr>
  <tr><td>Mayors' Grand River Cleanup</td><td>September</td><td>WMEAC. 2026 kickoff Sept 19. Billed Michigan's largest river cleanup</td></tr>
  <tr><td>Dam Jam</td><td>Late September</td><td>Brenke Fish Ladder, Lansing. New $3.5M amphitheatre, ~350 seats</td></tr>
  <tr><td>ArtPrize</td><td>Late Sep to Oct</td><td>~19 days. Began 2009, biennial since 2018</td></tr>
  <tr><td>World of Winter</td><td>Jan to Mar 1</td><td>Largest free winter festival in the US. 2026 ran Jan 9 to Mar 1</td></tr>
  <tr><td>Musical Fountain</td><td>Nightly, Memorial Day to Labor Day</td><td>Grand Haven, Dewey Hill, since 1963</td></tr>
  <tr><td>Fourth of July</td><td>Jul 4</td><td>Fireworks over the river, Grand Rapids and Grand Haven</td></tr></table>
  <p><strong>Rare or one-off.</strong> The <strong>Grand River Expedition</strong> is a source-to-mouth paddle roughly every ten years: 1990 (launched by Verlen Kruger), 2000, 2010 (largest, ~300 paddlers, 54 completing 220+ miles). A 2020 edition was cancelled by COVID. Return to the River, Paddlefest, River for All, snow snake competitions, luminary bike rides and the Ionia and Flat River cleanups run as programmes or occasional events. Confirm dates with organisers each year.</p>
  <p><strong>Rule:</strong> a regatta has a date. A salmon run has a probability window and a yearly strength. Do not write them the same way.</p>`
},
{
  id:'records', t:'Records and genuine superlatives', f:['people','history'], reach:'BASIN', c:'stable',
  tags:'record fish state record chinook essex black buffalo world record musical fountain artprize log jam longest',
  html:`<table><tr><th>Record</th><th>Detail</th></tr>
  <tr><td>Chinook salmon</td><td>46.06 lb, 43.5 in, 1978, Grand River, Kent County, angler Ray Essex of Grand Rapids. Held the Michigan record until Aug 7, 2021</td></tr>
  <tr><td>Black buffalo</td><td>46.54 lb, 38.5 in, 2018, Grand River, Ottawa County, by bow. Current state record. A prior 33.25 lb record also came from the Grand (2004)</td></tr>
  <tr><td>Longest river in Michigan</td><td>The Grand, 252 miles. Confirmed</td></tr>
  <tr><td>Great Log Jam 1883</td><td>One of the largest logjams in US history</td></tr>
  <tr><td>Grand Haven Musical Fountain</td><td>Built 1962 for about $50,000. World's largest musical fountain of its kind until the Bellagio opened in 1998</td></tr>
  <tr><td>ArtPrize</td><td>World's largest art competition. 2009 purse $449,000 including a $250,000 first prize to Ran Ortner</td></tr>
  <tr><td>Record flood</td><td>21.85 ft, April 21, 2013</td></tr>
  <tr><td>Gypsum</td><td>One of the richest gypsum-bearing formations in North America under the city</td></tr></table>
  <p><strong>Careful:</strong> Michigan's state-record flathead catfish (64.46 lb, 2025) came from Plum Creek in Monroe County, not the Grand, despite Grand Rapids coverage. The all-time record lake sturgeon (193 lb, 1974) came from Mullett Lake.</p>`
},
{
  id:'trivia', t:'Trivia worth knowing', f:['people','history'], reach:'MAINSTEM', c:'stable',
  tags:'trivia fun facts ford gypsum drinking water bridges blue bridge artprize steamboat whistle',
  html:`<ul>
    <li><strong>Nobody drinks the Grand.</strong> Grand Rapids draws from Lake Michigan through an intake nearly a mile offshore; it pumped river water from 1912 until about 1990. Lansing uses ~125 groundwater wells in the Saginaw Aquifer. Jackson uses 16 wells in the Marshall Aquifer.</li>
    <li>The <strong>Blue Bridge</strong> is the 1892 Grand Rapids &amp; Indiana Railroad span, about 575 ft, one of Michigan's longest truss bridges, converted to pedestrian use in the 1980s and painted its signature blue.</li>
    <li>The <strong>Sixth Street Bridge</strong> (1886, wrought iron) is a designated historic landmark. The <strong>Gillett Bridge</strong> (1915) was an interurban railway crossing.</li>
    <li><strong>Gerald and Betty Ford</strong> are buried on the grounds of the Ford Presidential Museum, on the west bank downtown.</li>
    <li>Gypsum tunnels under the city have held mushrooms, microfilmed legal records for about 70 percent of Michigan counties, a data centre and Founders beer. Mining subsidence sank a section of US-131 in the 1990s.</li>
    <li>An ArtPrize entry once floated a school-of-fish mobile on a rocky islet between the Blue Bridge and Pearl Street.</li>
    <li>Six-foot, century-old lake sturgeon still swim here.</li>
    <li><strong>Déjà vu:</strong> 47 years before the current work, Ah-Nab-Awen Park was also a construction zone.</li>
    <li>An LGROW Plaster Creek cleanup in July 2026 pulled <strong>seventeen shopping carts</strong> out of a tributary.</li>
  </ul>`
},
{
  id:'devel', t:'Riverfront development: the human river', f:['people','build'], reach:'DOWNTOWN', c:'official',
  tags:'amphitheater acrisure development greenway trail millage marine corps reserve center gvsu brownfield',
  html:`<p>The channel is not the only thing changing. Development alters what the river <em>feels like</em> without changing discharge at all.</p>
  <ul>
    <li><strong>Acrisure Amphitheater</strong> opened May 15, 2026. 12,000 seats, about $184M, Lionel Richie headlining with The War and Treaty and Brian Vander Ark. Anchors roughly 31 acres of riverfront redevelopment with up to 10 acres of new recreation space and a nearly four-acre Green Ribbon.</li>
    <li>The former <strong>Marine Corps Reserve Center</strong>, 3.5 acres at 1863 Monroe Ave NW, went to federal auction: opened $1.525M on July 13, 2026, pushed to $2.8M after 47 bids under a 24-hour soft close, against an original $4.9M asking price.</li>
    <li>A proposed <strong>20-story riverfront apartment tower</strong> is seeking transformational brownfield incentives.</li>
    <li><strong>GVSU</strong> trustees approved buying riverfront property immediately south of the Seidman College of Business.</li>
    <li><strong>August 4, 2026 millages</strong> in Ada Township, Plainfield Township and Ottawa County each affect the Grand River Greenway. Only Ottawa's ballot language says "greenways," but all three fund trails and parks along it.</li>
    <li>Greenway construction underway along <strong>Cannonsburg Road</strong>, led by Kent County Parks.</li>
  </ul>
  <p>A digital twin should keep a separate <strong>human intensity layer</strong>: pedestrians, bikes, event crowds, amplified sound, night lighting, closures, staging, fishing density, rowing density.</p>`
},

/* -------------------------------------------------------------- PRODUCTION */

/* ------------------------------------------------------------ ERROR TRAPS */
{
  id:'traps', t:'What people get wrong about the river', f:['water','build','life'], reach:'MAINSTEM', c:'stable',
  tags:'errors mistakes wrong corrections myths accuracy safe safety depth deep pristine spill flood claim',
  html:`<div class="trap"><span class="bad">"The river is 10 feet deep, the gauge says 10 ft."</span>Stage is relative to a datum. Say the gauge reads X ft; actual depth varies across the channel.</div>
  <div class="trap"><span class="bad">"They're removing Sixth Street Dam right now."</span>Active work removes four <em>downstream</em> low-head dams in the Lower Reach. Sixth Street is a separate Upper Reach question still in federal EIS.</div>
  <div class="trap"><span class="bad">"They're building a surf wave."</span>Not in the authorised design. Describe flow-dependent whitewater around rock structures.</div>
  <div class="trap"><span class="bad">"Restoration means it will never flood."</span>Say it is modelled not to increase mapped flood risk. Then use live NWS data.</div>
  <div class="trap"><span class="bad">"There are sturgeon here today."</span>Needs observation. Say habitat and passage improvements target sturgeon, and spring is the likely spawning window.</div>
  <div class="trap"><span class="bad">"Fish from the Grand are safe to eat."</span>Advisories are species and reach specific. Live-check MDHHS.</div>
  <div class="trap"><span class="bad">"The river has returned to its natural state."</span>Say restored habitat and processes inside an altered urban channel.</div>
  <div class="trap"><span class="bad">"Brown water means a spill."</span>Turbidity has many causes. Check storms, construction monitoring and official incident reports.</div>
  <div class="trap"><span class="bad">"It's warm out, so the river is warm."</span>Spring water lags air by many degrees. Use live water temperature.</div>
  <div class="trap"><span class="bad">"Salmon run every October 1."</span>Biological timing varies. Use temperature, flow and date as a probability window.</div>`
},
{
  id:'under', t:'What is under the river', f:['water','history'], reach:'BASIN', c:'stable',
  tags:'under underneath below beneath layers geology rock bedrock limestone gypsum mine shale fill sediment bed strata ground',
  html:`<p>From the water down, through downtown:</p>
  <table><tr><th>Layer</th><th>What it is</th></tr>
  <tr><td>Water</td><td>A few feet deep in most of the channel, deeper in pools. Depth changes with flow. Gage height is not depth.</td></tr>
  <tr><td>Riverbed</td><td>Originally limestone ledges, gravel, cobble and boulder. After dredging, finer sediment pooled behind the dams. The Lower Reach rebuilds a coarse rock bed.</td></tr>
  <tr><td>Riverfront fill</td><td>Roughly 300,000 cubic yards of gravel, cobble and boulder dredged from the river and used to build up and extend the banks. It narrowed the channel.</td></tr>
  <tr><td>River and glacial deposits</td><td>Sand, gravel and silt left by the river and by meltwater at the end of the last ice age.</td></tr>
  <tr><td>Limestone bedrock</td><td>Mississippian-age limestone. Its ledges are the reason the rapids fell fast and loud.</td></tr>
  <tr><td>Michigan Formation</td><td>Shale, limestone and gypsum. Grand Rapids sits on one of North America's richest gypsum deposits; mining began near Plaster Creek around 1841.</td></tr>
  <tr><td>Gypsum mines</td><td>Up to about six miles of tunnels roughly 85 to 100 feet down under parts of the metro area, mostly southwest of downtown. Later used for mushrooms, microfilmed county records, a data centre and Founders beer.</td></tr></table>
  <p>The 3D model at the top of the page shows these layers on the sides of the block and in the cross-section. Depths there are schematic.</p>`
},
{
  id:'eras', t:'How the downtown river changed, era by era', f:['history','build'], reach:'MAINSTEM', c:'stable',
  tags:'change changed through the years eras history timeline before after dams rapids engineered restored model 3d evolution',
  html:`<table><tr><th>Era</th><th>What the river looked like</th></tr>
  <tr><td>Before 1826</td><td>About 18 ft of fall over roughly a mile of limestone ledges. White water nearly bank to bank. Anishinaabe homeland, Odawa village at the rapids.</td></tr>
  <tr><td>1849 to 1880</td><td>A dam at Sixth Street and a mill canal turn the rapids into water power. River power lights the city July 26, 1880.</td></tr>
  <tr><td>1883</td><td>The Great Log Jam: over 600,000 logs break loose and take out every railroad bridge.</td></tr>
  <tr><td>1911 to 1931</td><td>Floodwalls after the 1904 flood, about 300,000 cubic yards dredged into riverfront fill, four low-head dams below Sixth Street. The rapids become a staircase of pools.</td></tr>
  <tr><td>1969</td><td>As much as 12.6 billion gallons of raw sewage in one year through combined sewer outfalls.</td></tr>
  <tr><td>1991 to 2015</td><td>All 59 outfalls sealed, the last on July 13, 2015. Fish ladder since 1974. Record crest 21.85 ft in 2013; the walls held.</td></tr>
  <tr><td>2026</td><td>Lower Reach construction: causeways, turbidity curtains, a cofferdam, staging at Ah-Nab-Awen. Sixth Street Dam stays.</td></tr>
  <tr><td>Fall 2027, expected</td><td>The four dams' drop spread across two rock grade-control structures, riffles, 125 plus boulders and three J-hooks. No surf wave.</td></tr>
  <tr><td>After 2027</td><td>Upper Reach undecided. Seven alternatives in the federal EIS; Draft EIS anticipated July 2027.</td></tr></table>
  <p>Scrub through all of these in the model at the top of the page.</p>`
},
{
  id:'sources', t:'Where the facts come from', f:['water','history','build'], reach:'BASIN', c:'stable',
  tags:'sources bibliography usgs nws nrcs egle dnr mdhhs grpm whitewater citations',
  html:`<ul>
    <li>USGS 04119000 and 04118564: live discharge, stage, temperature, water quality</li>
    <li>NOAA / NWS gauge GDRM4: flood thresholds, forecasts, historic crests</li>
    <li>NWS Grand Rapids 1991-2020 climate normals</li>
    <li>USDA NRCS, Lower Grand River Habitat Restoration Final EA, January 2026</li>
    <li>Grand Rapids WhiteWater: project design, funding, permits, mussels, EIS status</li>
    <li>City of Grand Rapids: contract award Feb 2026, funding approval Mar 2026, sewer improvement, wastewater, climate plan, River for All</li>
    <li>Michigan EGLE: permits and biological assessments</li>
    <li>Michigan DNR: 2026 fishing regulations (through Mar 31, 2027), Grand River Assessment 2011, species records</li>
    <li>MDHHS Eat Safe Fish</li>
    <li>Great Lakes Fishery Commission and USACE: Upper Reach EIS</li>
    <li>Grand River Bands of Ottawa Indians</li>
    <li>Grand Rapids Public Museum, History Grand Rapids, Junior League historical markers</li>
    <li>LGROW, WMEAC, Grand Rapids Rowing, Grand River Network River Reader</li>
  </ul>
  <p>Base research compiled ${'August 1, 2026'}. Construction, regulations, advisories and hydrology are time sensitive and get refreshed by the weekly deep dive.</p>`
}
];

/* ---------- the doctrine the model answers under ---------- */
const DOCTRINE = `You are the River Brain: a spatially and temporally aware model of the Grand River through Grand Rapids, Michigan. You are a public guide for anyone who lives near the river, works on it, or visits it.

BEFORE ANSWERING, resolve six things: where on the river (reach), when, what hydrologic state, what ecological season, what construction state, and how confident you are.

REACHES: BASIN (whole 5,572 sq mi watershed) / MAINSTEM (through Grand Rapids) / LOWER REACH (Bridge St to Fulton St, active 2026-27 restoration) / UPPER REACH (Ann St to Bridge St, Sixth Street Dam and lamprey barrier EIS) / DOWNTOWN (banks, bridges, parks, public realm) / CORRIDOR (beyond downtown).

CONFIDENCE CLASSES: OBSERVED_LIVE, OFFICIAL_CURRENT, STABLE_FACT, SEASONAL_LIKELY, PLANNED_FUTURE, SCENARIO_ONLY. End every answer with a line in exactly this format: [[CONF:class]] using the single most appropriate class.

HARD RULES
- Never invent current stage, discharge, water temperature, turbidity, dissolved oxygen, weather, closures or construction progress. If asked about now, search the web. If you cannot get it, say the live value is unavailable.
- Gage height is never river depth.
- Attach a reach tag to every construction claim.
- Lower Reach construction does NOT remove Sixth Street Dam.
- The current Lower Reach design has NO purpose-built standing surf wave.
- Upper Reach alternatives are undecided until the federal EIS selects one. Label any of them SCENARIO.
- Treat wildlife presence as probable unless observed.
- Never give fish-eating advice without pointing to the current MDHHS Eat Safe Fish guide.
- Never say restoration eliminates flooding. Say it is modelled not to increase mapped flood risk.
- Never call the restored downtown river pristine or historically exact.
- For any recreation safety question use live water level, temperature, weather, construction zones and official advisories. Season alone never makes the river safe.
- Label seasonal fallback data as typical or simulated.
- Indigenous presence is present tense, not only historical.

VOICE: direct, specific, useful to a curious visitor. No preamble. Lead with the answer. Short paragraphs. Use markdown. No em dashes anywhere, ever. Use commas, colons or parentheses instead. If something in the knowledge below is relevant, use it and say so plainly rather than hedging.`;

/* ============================================================================
   RETRIEVAL: cheap keyword scoring so the model gets the right 6-8 entries
   ========================================================================= */
const STOP = new Set('the a an and or of in on at to for is are was were be it its this that what how why when where do does did i you we they with from about can could would should there their them then than as by if not no'.split(' '));

function retrieve(q, n = 7){
  const words = q.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  if(!words.length) return KB.slice(0, n);
  const scored = KB.map(e => {
    const hay = (e.t + ' ' + e.tags + ' ' + e.html.replace(/<[^>]+>/g,' ')).toLowerCase();
    let s = 0;
    for(const w of words){
      if(e.tags.includes(w)) s += 6;
      if(e.t.toLowerCase().includes(w)) s += 8;
      const m = hay.split(w).length - 1;
      s += Math.min(m, 6);
    }
    return {e, s};
  }).sort((a,b) => b.s - a.s);
  const top = scored.filter(x => x.s > 0).slice(0, n).map(x => x.e);
  const out = top.length ? top : KB.slice(0, 4);
  /* the guardrails ride along on every question */
  ['traps','grammar'].forEach(id => {
    if(!out.some(e => e.id === id)){ const e = KB.find(x => x.id === id); if(e) out.push(e); }
  });
  return out;
}

function asPlain(e){
  const txt = e.html
    .replace(/<\/(p|li|tr|dd|div)>/g,'\n')
    .replace(/<\/(td|th|dt)>/g,' | ')
    .replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&eacute;/g,'e').replace(/&egrave;/g,'e')
    .replace(/\n{3,}/g,'\n\n').trim();
  return `### ${e.t}  [reach:${e.reach}] [confidence:${CONF[e.c][0]}]\n${txt}`;
}


/* ============================================================================
   LIVE DATA
   USGS Water Services supports CORS, so the browser reads the gauges directly.
   Nothing here is ever guessed. If a fetch fails the widget says so and links
   out to the gauge page.
   ========================================================================= */

const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const GAUGES = {
  npark: { id:'04118564', name:'North Park Street', url:'https://waterdata.usgs.gov/nwis/uv?site_no=04118564&legacy=1' },
  gr:    { id:'04119000', name:'Grand Rapids',      url:'https://waterdata.usgs.gov/nwis/uv?site_no=04119000&legacy=1' }
};

/* USGS parameter codes */
const P = {
  '00010':{k:'tempC',  label:'Water temperature', unit:'°C'},
  '00060':{k:'flow',   label:'Discharge',         unit:'cfs'},
  '00065':{k:'stage',  label:'Gage height',       unit:'ft'},
  '00300':{k:'do',     label:'Dissolved oxygen',  unit:'mg/L'},
  '00095':{k:'cond',   label:'Conductance',       unit:'µS/cm'},
  '63680':{k:'turb',   label:'Turbidity',         unit:'FNU'},
  '00400':{k:'ph',     label:'pH',                unit:''}
};

/* Typical monthly values at Grand Rapids. ESTIMATES for context, labelled as such.
   Calibrated against River Reader observations so the verdict reads the way Andy
   writes it: 2,400 cfs in early July is "just below average"; 1,300 cfs in late
   July is "well below". */
const TYPICAL = {
  /* median discharge, cfs */
  flowMed: [2900,3400,6200,6800,4400,3100,2800,1900,1900,2300,3200,3200],
  flow:    [[2200,3800],[2600,4500],[4500,8000],[5000,9000],[3200,6000],[2200,4200],
            [1500,3000],[1200,2400],[1200,2600],[1500,3200],[2200,4500],[2400,4200]],
  /* median water temperature, F */
  tempMed: [34,34,41,51,62,70,76,75,70,60,46,37],
  tempF:   [[32,39],[32,39],[36,45],[45,55],[55,66],[64,73],
            [72,81],[72,81],[64,73],[50,63],[39,50],[32,41]]
};

/* NWS GDRM4 flood thresholds, feet */
const FLOOD = [
  ['Bankfull',       12, 'var(--stable)'],
  ['Flood stage',    18, 'var(--seasonal)'],
  ['Moderate flood', 21, 'var(--planned)'],
  ['Major flood',    23, 'var(--alert)']
];

const LIVE = { ok:false, at:null, vals:{}, err:null };

function cToF(c){ return c == null ? null : (c * 9/5) + 32; }

async function usgs(sites, params, period){
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${sites}`
            + `&parameterCd=${params}&siteStatus=all${period ? '&period=' + period : ''}`;
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok) throw new Error('USGS ' + res.status);
  const j = await res.json();
  const out = {}, series = {};
  for(const ts of (j?.value?.timeSeries || [])){
    const code = ts?.variable?.variableCode?.[0]?.value;
    const site = ts?.sourceInfo?.siteCode?.[0]?.value;
    const vals = ts?.values?.[0]?.value || [];
    const meta = P[code]; if(!meta || !vals.length) continue;
    const good = vals.map(pt => ({t:pt.dateTime, v:parseFloat(pt.value)})).filter(p => isFinite(p.v) && p.v > -999999);
    if(!good.length) continue;
    const last = good[good.length - 1];
    out[`${site}:${meta.k}`] = { v:last.v, at:last.t, label:meta.label, unit:meta.unit };
    if(period){ const step = Math.max(1, Math.floor(good.length/168)); series[meta.k] = good.filter((_, i) => i % step === 0 || i === good.length - 1); }
  }
  return period ? {out, series} : out;
}
/* USGS daily statistics: the median for every calendar day, when the site has enough record */
async function usgsMedians(site, param){
  const url = `https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=${site}&statReportType=daily&statTypeCd=median&parameterCd=${param}`;
  const res = await fetch(url, {cache:'force-cache'});
  if(!res.ok) throw new Error('USGS stat ' + res.status);
  const lines = (await res.text()).split('\n').filter(l => l && !l.startsWith('#'));
  const cols = lines[0].split('\t'), mi = cols.indexOf('month_nu'), di = cols.indexOf('day_nu'), vi = cols.indexOf('p50_va');
  if(mi < 0 || di < 0 || vi < 0) throw new Error('no medians');
  const map = {};
  for(const l of lines.slice(2)){ const f = l.split('\t'); const v = parseFloat(f[vi]); if(isFinite(v)) map[`${+f[mi]}-${+f[di]}`] = v; }
  if(Object.keys(map).length < 300) throw new Error('short record');
  return map;
}
const SITE = {lat:42.9744, lng:-85.6746};
async function weather(){
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${SITE.lat}&longitude=${SITE.lng}`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,is_day`
    + `&daily=sunrise,sunset,uv_index_max,precipitation_probability_max,temperature_2m_max,temperature_2m_min,precipitation_sum`
    + `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FDetroit&forecast_days=2`;
  const r = await fetch(u); if(!r.ok) throw new Error('weather ' + r.status);
  return r.json();
}
async function airQuality(){
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SITE.lat}&longitude=${SITE.lng}&current=us_aqi,pm2_5,pm10,ozone,us_aqi_pm2_5,us_aqi_ozone&timezone=America%2FDetroit`;
  const r = await fetch(u); if(!r.ok) throw new Error('air ' + r.status);
  return r.json();
}
async function nwsForecast(){
  const r = await fetch('https://api.water.noaa.gov/nwps/v1/gauges/GDRM4/stageflow');
  if(!r.ok) throw new Error('NWS ' + r.status);
  const j = await r.json();
  const f = (j.forecast?.data || []).map(p => ({t:p.validTime, v:+p.primary, q:+p.secondary})).filter(p => isFinite(p.v));
  const o = (j.observed?.data || []).map(p => ({t:p.validTime, v:+p.primary, q:+p.secondary})).filter(p => isFinite(p.v));
  return {issued:j.forecast?.issuedTime || null, forecast:f, observed:o};
}

let refreshT = null;
async function loadLive(){
  try{
    const vals = await usgs(`${GAUGES.npark.id},${GAUGES.gr.id}`, '00010,00060,00065,00300,00095,63680,00400');
    if(!Object.keys(vals).length) throw new Error('No current readings returned');
    LIVE.vals = vals; LIVE.ok = true; LIVE.err = null;
    const stamps = Object.values(vals).map(v => v.at).filter(Boolean).sort();
    LIVE.at = stamps.length ? new Date(stamps[stamps.length-1]) : new Date();
  }catch(err){
    LIVE.ok = false; LIVE.err = err.message || String(err);
  }
  LIVE.read = new Date();
  renderWidgets();
  if(typeof Twin !== 'undefined') Twin.onLive();
  /* the slower extras, each on its own */
  const later = [
    usgs(`${GAUGES.npark.id},${GAUGES.gr.id}`, '00010,00060,00065', 'P7D').then(r => { LIVE.series = r.series; }),
    LIVE.med.flow ? Promise.resolve() : usgsMedians(GAUGES.gr.id, '00060').then(m => { LIVE.med.flow = m; }),
    LIVE.med.tempC ? Promise.resolve() : usgsMedians(GAUGES.npark.id, '00010').then(m => { LIVE.med.tempC = m; }),
    weather().then(w => { LIVE.wx = w; LIVE.wxErr = null; }).catch(e => { LIVE.wxErr = e.message; }),
    airQuality().then(a => { LIVE.aq = a; LIVE.aqErr = null; }).catch(e => { LIVE.aqErr = e.message; }),
    nwsForecast().then(f => { LIVE.fc = f; LIVE.fcErr = null; }).catch(e => { LIVE.fcErr = e.message; })
  ];
  await Promise.allSettled(later);
  renderWidgets();
}
Object.assign(LIVE, {series:{}, med:{}, wx:null, aq:null, fc:null, read:null});

/* pick a reading, preferring whichever gauge actually reports it */
function pick(key){
  return LIVE.vals[`${GAUGES.npark.id}:${key}`] || LIVE.vals[`${GAUGES.gr.id}:${key}`] || null;
}

/* Medians are mid-month anchors. Interpolate by day, because water temperature
   and flow both move fast enough inside a month that a monthly step lies. */
function interp(arr, d = new Date()){
  const m = d.getMonth(), day = d.getDate();
  const dim = new Date(d.getFullYear(), m+1, 0).getDate();
  let a, b, t;
  if(day >= 15){ a = arr[m]; b = arr[(m+1) % 12]; t = (day - 15) / dim; }
  else { a = arr[(m+11) % 12]; b = arr[m]; t = (day + dim - 15) / dim; }
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/* today's median from USGS when we have it, the calibrated estimate otherwise */
function typical(k, d = new Date()){
  const m = LIVE.med[k];
  if(m){ const v = m[`${d.getMonth() + 1}-${d.getDate()}`]; if(isFinite(v)) return {v:k === 'tempC' ? cToF(v) : v, src:'USGS daily median'}; }
  return {v:interp(k === 'tempC' ? TYPICAL.tempMed : TYPICAL.flowMed, d), src:'estimate'};
}
function flowVerdict(val, d = new Date()){
  if(val == null) return null;
  const r = val / typical('flow', d).v;
  if(r < 0.55)  return ['Well below average','var(--alert)'];
  if(r < 0.90)  return ['Just below average','var(--seasonal)'];
  if(r <= 1.15) return ['About average','var(--live)'];
  if(r <= 1.75) return ['Above average','var(--seasonal)'];
  return ['Well above average','var(--alert)'];
}
function tempVerdict(f, d = new Date()){
  if(f == null) return null;
  const diff = f - typical('tempC', d).v;
  if(diff <= -10) return ['Much colder than usual','var(--official)'];
  if(diff <=  -5) return ['Cooler than usual','var(--official)'];
  if(diff <    5) return ['About normal','var(--live)'];
  if(diff <   10) return ['Warmer than usual','var(--seasonal)'];
  return ['Much warmer than usual','var(--alert)'];
}
const fmt = (n, d=0) => n == null ? 'n/a'
  : n.toLocaleString('en-US',{minimumFractionDigits:d, maximumFractionDigits:d});
const ago = d => { if(!d) return ''; const m = Math.round((Date.now() - d.getTime())/60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m/60)} h ago`; };
const WMO = c => c === 0 ? ['sun','Clear'] : c <= 2 ? ['sun','Partly cloudy'] : c === 3 ? ['cloud','Overcast'] : c <= 48 ? ['fog','Fog'] : c <= 57 ? ['rain','Drizzle'] : c <= 67 ? ['rain','Rain'] : c <= 77 ? ['snow','Snow'] : c <= 82 ? ['rain','Showers'] : c <= 86 ? ['snow','Snow showers'] : ['storm','Thunderstorm'];
const AQI = a => a <= 50 ? ['Good','var(--live)'] : a <= 100 ? ['Moderate','var(--seasonal)'] : a <= 150 ? ['Unhealthy for sensitive groups','var(--planned)'] : a <= 200 ? ['Unhealthy','var(--alert)'] : a <= 300 ? ['Very unhealthy','var(--alert)'] : ['Hazardous','var(--alert)'];
const hm = iso => { try{ return new Date(iso).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}); }catch(e){ return ''; } };

/* ---------- the widgets ---------- */
function spark(series, color){
  if(!series || series.length < 4) return '';
  const vs = series.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), rng = (hi - lo) || 1;
  const pts = series.map((p, i) => `${(i/(series.length - 1)*100).toFixed(1)},${(26 - (p.v - lo)/rng*24).toFixed(1)}`).join(' ');
  return `<svg class="w-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg><span class="w-sparkl">7 days</span>`;
}
function tile(o){
  const band = o.band || 'var(--muted)';
  return `<div class="w ${o.wide ? 'w-wide' : ''}" style="--band:${band}" data-tile="${o.id}">
    <div class="w-head"><span class="w-lab">${ic(o.icon)} ${o.label}</span><span class="w-tools">${o.tag ? `<span class="tag ${o.tagc || 't-live'}">${o.tag}</span>` : ''}<button class="w-i" type="button" aria-label="What this means" title="What this means">${ic('info')}</button></span></div>
    <div class="w-front">${o.front}</div>
    <div class="w-back">${o.back}${o.src ? `<a class="w-src" href="${o.src[1]}" target="_blank" rel="noopener">${ic('external')} ${o.src[0]}</a>` : ''}</div>
  </div>`;
}
const dead = (id, icon, label, note, back, src) => tile({id, icon, label, band:'var(--muted)', front:`<div class="w-big dim">Unavailable</div><div class="w-sub">${note}</div>`, back, src});
function ladder(stage){
  const top = 26, y = v => 100 - Math.min(100, Math.max(0, v/top*100));
  return `<div class="w-ladder" aria-hidden="true">
    ${FLOOD.map(f => `<span class="w-lstep" style="bottom:${100 - y(f[1])}%;--c:${f[2]}" title="${f[0]} ${f[1]} ft"></span>`).join('')}
    <span class="w-lnow" style="height:${100 - y(stage)}%"></span></div>`;
}
function renderWidgets(){
  const el = document.getElementById('widgets'); if(!el) return;
  const tempC = pick('tempC'), flow = pick('flow'), stage = pick('stage'), turb = pick('turb'), dox = pick('do'), ph = pick('ph'), cond = pick('cond');
  const tF = tempC ? cToF(tempC.v) : null, tV = tempVerdict(tF), fV = flowVerdict(flow?.v);
  const S = LIVE.series || {}, wx = LIVE.wx, aq = LIVE.aq, fc = LIVE.fc;
  const usgsN = ['USGS 04118564', GAUGES.npark.url], usgsG = ['USGS 04119000', GAUGES.gr.url];
  const offline = LIVE.err ? 'Gauge unreachable: ' + LIVE.err : 'Not reporting right now';
  let h = '';

  /* water temperature */
  h += LIVE.ok && tF != null ? tile({id:'temp', icon:'thermo', label:'Water temperature', tag:'Live', band:'var(--live)',
      front:`<div class="w-big">${fmt(tF,1)}<small>°F</small></div><div class="w-sub">${fmt(tempC.v,1)} °C · usual for today about ${fmt(typical('tempC').v,0)} °F</div>${tV ? `<span class="verdict" style="color:${tV[1]}">${tV[0]}</span>` : ''}${spark(S.tempC, 'var(--live)')}`,
      back:`<p>Read at North Park Street, upstream of downtown. Salmon move in when it drops into the high 50s and low 60s. Below 60 °F cold water is a real risk for people. The "usual" figure is ${typical('tempC').src === 'estimate' ? 'an estimate calibrated to the River Reader' : 'the USGS daily median for the record'}.</p>`, src:usgsN})
    : dead('temp', 'thermo', 'Water temperature', offline, '<p>USGS instantaneous data, provisional, updated about every 15 minutes.</p>', usgsN);
  /* flow */
  h += LIVE.ok && flow ? tile({id:'flow', icon:'waves', label:'Flow', tag:'Live', band:'var(--live)',
      front:`<div class="w-big">${fmt(flow.v)}<small>cfs</small></div><div class="w-sub">usual for today about ${fmt(typical('flow').v)} cfs</div>${fV ? `<span class="verdict" style="color:${fV[1]}">${fV[0]}</span>` : ''}${spark(S.flow, 'var(--live)')}`,
      back:`<p>Cubic feet per second past the Grand Rapids gauge near Fulton Street. Spring snowmelt often tops 7,000. Late summer drops under 2,000. Above about 5,000 the river is fast and pushy. Provisional, revised later by USGS.</p>`, src:usgsG})
    : dead('flow', 'waves', 'Flow', offline, '<p>Discharge from the Grand Rapids gauge, provisional.</p>', usgsG);
  /* height */
  h += LIVE.ok && stage ? tile({id:'stage', icon:'ruler', label:'Water height', tag:'Live', band: stage.v >= 18 ? 'var(--alert)' : stage.v >= 12 ? 'var(--seasonal)' : 'var(--live)',
      front:`<div class="w-row"><div><div class="w-big">${fmt(stage.v,2)}<small>ft</small></div><div class="w-sub">gage height, not depth</div><span class="verdict" style="color:${stage.v >= 18 ? 'var(--alert)' : stage.v >= 12 ? 'var(--seasonal)' : 'var(--live)'}">${stage.v >= 23 ? 'Major flood' : stage.v >= 21 ? 'Moderate flood' : stage.v >= 18 ? 'Flood stage' : stage.v >= 12 ? 'Bankfull' : 'Normal'}</span></div>${ladder(stage.v)}</div>${spark(S.stage, 'var(--live)')}`,
      back:`<p>Gage height is the water surface above a fixed datum, not how deep the river is. NWS thresholds: 12 ft bankfull, 18 flood, 21 moderate, 23 major. Record 21.85 ft on April 21, 2013.</p>`, src:['NWS GDRM4', 'https://water.noaa.gov/gauges/GDRM4']})
    : dead('stage', 'ruler', 'Water height', offline, '<p>Gage height from the Grand Rapids gauge. Flood stage is 18 ft.</p>', usgsG);
  /* forecast */
  if(fc && fc.forecast && fc.forecast.length){
    const f = fc.forecast, mx = f.reduce((a, b) => b.v > a.v ? b : a, f[0]), last = f[f.length - 1], first = f[0];
    const trend = last.v - first.v, tr = Math.abs(trend) < 0.3 ? ['Steady', 'var(--live)'] : trend > 0 ? ['Rising', 'var(--seasonal)'] : ['Falling', 'var(--live)'];
    h += tile({id:'fc', icon:'calendar', label:'River forecast', tag:'NWS', band:mx.v >= 18 ? 'var(--alert)' : mx.v >= 12 ? 'var(--seasonal)' : 'var(--live)',
      front:`<div class="w-big">${fmt(mx.v,1)}<small>ft peak</small></div><div class="w-sub">${new Date(mx.t).toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} · ${fmt(mx.q)} cfs</div><span class="verdict" style="color:${tr[1]}">${tr[0]} over the forecast</span>`,
      back:`<p>National Weather Service stage forecast for the Grand Rapids gauge${fc.issued ? ', issued ' + new Date(fc.issued).toLocaleString('en-US',{month:'short', day:'numeric', hour:'numeric'}) : ''}. Forecasts change with every rain.</p>`, src:['NWS GDRM4', 'https://water.noaa.gov/gauges/GDRM4']});
  } else h += dead('fc', 'calendar', 'River forecast', LIVE.fcErr ? 'Forecast not reachable from here' : 'Waiting for the forecast', '<p>The NWS river forecast for GDRM4. Open the link for the official hydrograph.</p>', ['NWS GDRM4', 'https://water.noaa.gov/gauges/GDRM4']);
  /* clarity */
  h += LIVE.ok && turb ? tile({id:'turb', icon:'eye', label:'Clarity', tag:'Live', band:'var(--live)',
      front:`<div class="w-big">${fmt(turb.v,1)}<small>FNU</small></div><div class="w-sub">turbidity</div><span class="verdict" style="color:${turb.v < 10 ? 'var(--live)' : turb.v < 40 ? 'var(--seasonal)' : 'var(--alert)'}">${turb.v < 10 ? 'Clear' : turb.v < 40 ? 'Murky' : 'Muddy'}</span>`,
      back:`<p>Turbidity is light scattered by suspended sediment. Under 10 is clear enough to see rock. Rain, snowmelt and in-river construction all push it up. The model tints its water with this number.</p>`, src:usgsN})
    : dead('turb', 'eye', 'Clarity', offline, '<p>Turbidity in FNU from North Park Street.</p>', usgsN);
  /* oxygen */
  h += LIVE.ok && dox ? tile({id:'do', icon:'water-quality', label:'Oxygen', tag:'Live', band:'var(--live)',
      front:`<div class="w-big">${fmt(dox.v,1)}<small>mg/L</small></div><div class="w-sub">dissolved oxygen</div><span class="verdict" style="color:${dox.v >= 7 ? 'var(--live)' : dox.v >= 5 ? 'var(--seasonal)' : 'var(--alert)'}">${dox.v >= 7 ? 'Good for cold-water fish' : dox.v >= 5 ? 'Fine for most fish' : 'Stressful for fish'}</span>`,
      back:`<p>Trout and salmon want 7 mg/L or more. Below 5 most fish struggle. Warm, slow, low water in August is when it sags. Rapids put oxygen back in, which is one reason for the restoration.</p>`, src:usgsN})
    : dead('do', 'water-quality', 'Oxygen', offline, '<p>Dissolved oxygen from North Park Street.</p>', usgsN);
  /* chemistry */
  h += LIVE.ok && (ph || cond) ? tile({id:'chem', icon:'drop', label:'Chemistry', tag:'Live', band:'var(--live)',
      front:`<div class="w-two"><div><div class="w-big">${ph ? fmt(ph.v,1) : 'n/a'}</div><div class="w-sub">pH</div></div><div><div class="w-big">${cond ? fmt(cond.v) : 'n/a'}</div><div class="w-sub">µS/cm conductance</div></div></div>`,
      back:`<p>pH near 8 is normal for a limestone river. Conductance tracks dissolved salts: it climbs in winter with road salt runoff and drops in snowmelt. Neither says anything about bacteria. For that, EGLE and the county health department post seasonal E. coli results.</p>`, src:usgsN})
    : dead('chem', 'drop', 'Chemistry', offline, '<p>pH and specific conductance from North Park Street.</p>', usgsN);
  /* weather */
  if(wx && wx.current){
    const c = wx.current, [wi, wt] = WMO(c.weather_code), d = wx.daily || {};
    h += tile({id:'wx', icon:wi, label:'Weather now', tag:'Open-Meteo', tagc:'t-plain', band:'var(--stable)',
      front:`<div class="w-big">${fmt(c.temperature_2m,0)}<small>°F</small></div><div class="w-sub">${wt} · feels ${fmt(c.apparent_temperature,0)} · wind ${fmt(c.wind_speed_10m,0)} mph${c.wind_gusts_10m > 20 ? ', gusts ' + fmt(c.wind_gusts_10m,0) : ''}</div><span class="verdict plain">${d.precipitation_probability_max ? `${d.precipitation_probability_max[0]}% chance of rain today` : ''}${d.temperature_2m_max ? ` · high ${fmt(d.temperature_2m_max[0],0)}, low ${fmt(d.temperature_2m_min[0],0)}` : ''}</span>`,
      back:`<p>Hourly model weather at the dam. Rain upstream matters more than rain here: the river answers Lansing's storms a day or two later. UV index now ${fmt(c.uv_index,0)}, humidity ${fmt(c.relative_humidity_2m,0)}%.</p>`, src:['Open-Meteo', 'https://open-meteo.com/']});
  } else h += dead('wx', 'cloud', 'Weather now', LIVE.wxErr ? 'Weather not reachable' : 'Loading', '<p>Open-Meteo model weather for the dam.</p>', ['Open-Meteo', 'https://open-meteo.com/']);
  /* air */
  if(aq && aq.current && isFinite(aq.current.us_aqi)){
    const a = aq.current, [al, ac] = AQI(a.us_aqi);
    h += tile({id:'aq', icon:'air', label:'Air quality', tag:'US AQI', tagc:'t-plain', band:ac,
      front:`<div class="w-big">${fmt(a.us_aqi,0)}</div><div class="w-sub">PM2.5 ${fmt(a.pm2_5,0)} µg/m³ · ozone ${fmt(a.ozone,0)} µg/m³</div><span class="verdict" style="color:${ac}">${al}</span>`,
      back:`<p>US Air Quality Index from the CAMS model, not a street monitor. Under 50 is good, 51 to 100 moderate, over 100 sensitive groups should ease off. Wildfire smoke summers push it up. For official readings see EGLE's MiAir.</p>`, src:['Open-Meteo air quality', 'https://open-meteo.com/en/docs/air-quality-api']});
  } else h += dead('aq', 'air', 'Air quality', LIVE.aqErr ? 'Air quality not reachable' : 'Loading', '<p>US AQI from the Open-Meteo air quality model.</p>', ['Open-Meteo', 'https://open-meteo.com/']);
  /* sun */
  if(wx && wx.daily && wx.daily.sunrise){
    const sr = new Date(wx.daily.sunrise[0]), ss = new Date(wx.daily.sunset[0]), len = (ss - sr)/3600000, gh = new Date(ss.getTime() - 55*60000);
    h += tile({id:'sun', icon:'sunrise', label:'Light', tag:'Today', tagc:'t-plain', band:'var(--stable)',
      front:`<div class="w-two"><div><div class="w-big">${hm(sr)}</div><div class="w-sub">sunrise</div></div><div><div class="w-big">${hm(ss)}</div><div class="w-sub">sunset</div></div></div><span class="verdict plain">${len.toFixed(1)} h of daylight · golden hour from ${hm(gh)}</span>`,
      back:`<p>For photographers: the west bank gets warm light at sunset across the water toward the skyline, the east bank at sunrise. Blue Bridge and Ah-Nab-Awen face west. UV max today ${fmt(wx.daily.uv_index_max ? wx.daily.uv_index_max[0] : null,0)}.</p>`, src:['Open-Meteo', 'https://open-meteo.com/']});
  } else h += dead('sun', 'sunrise', 'Light', 'Loading', '<p>Sunrise and sunset at the dam.</p>', ['Open-Meteo', 'https://open-meteo.com/']);
  /* wading and paddling read */
  { let verdict, colr, note;
    if(!LIVE.ok || !flow || !stage){ verdict = 'No read without the gauge'; colr = 'var(--muted)'; note = 'Check the gauge yourself before going near the water.'; }
    else if(stage.v >= 12 || flow.v > 8000){ verdict = 'Stay out. High water'; colr = 'var(--alert)'; note = 'Bank-full or worse. Fast, cold, full of debris.'; }
    else if(flow.v > 5000 || stage.v > 9){ verdict = 'Paddling for the experienced only. No wading'; colr = 'var(--seasonal)'; note = 'Strong current, cold water risk.'; }
    else if(tF != null && tF < 50){ verdict = 'Cold water. Dry suit or stay dry'; colr = 'var(--seasonal)'; note = `Water ${fmt(tF,0)} °F. Cold shock in minutes.`; }
    else if(flow.v <= 3500){ verdict = 'Fair for paddling and wading the edges'; colr = 'var(--live)'; note = 'Stay well clear of every dam face, above and below.'; }
    else { verdict = 'Moving water. Life jacket, know the river'; colr = 'var(--seasonal)'; note = 'Fine for capable paddlers, no wading in the current.'; }
    h += tile({id:'safe', icon:'swim', label:'Wade or paddle', tag:'Derived', tagc:'t-plain', band:colr,
      front:`<span class="verdict big" style="color:${colr}">${verdict}</span><div class="w-sub">${note}</div><div class="w-sub warn">${ic('warn')} The Lower Reach work zone, Bridge Street to Fulton, is closed to river users during construction.</div>`,
      back:`<p>This is a rule of thumb from flow, height and temperature, not an official advisory. Low-head dams create a drowning current on the downstream side that looks harmless. Never go near the Sixth Street Dam face from either side. Wear a life jacket. Michigan law requires one aboard.</p>`, src:['Grand Rapids river safety', 'https://www.grandrapidsmi.gov/Government/Departments/Parks-and-Recreation']}); }
  /* season and construction */
  { const [sn, sd] = seasonNow(), [pn, pc, pd] = phaseNow();
    h += tile({id:'season', icon:'fish', label:'Season', tag:MON[new Date().getMonth()], tagc:'t-plain', band:'var(--seasonal)',
      front:`<div class="w-big small">${sn}</div><div class="w-sub">${sd}</div><button class="act w-go" data-go="life">${ic('fish')} See who is in the river</button>`,
      back:`<p>Seasons here follow water temperature more than the calendar. Salmon key on cooling water in the 60s, steelhead on the spring warm-up, mussel work on warm low water.</p>`});
    h += tile({id:'phase', icon:'build', label:'Construction', tag:pn, tagc:'t-' + (pc === 'official' ? 'official' : 'planned'), band:`var(--${pc})`,
      front:`<div class="w-big small">${pn}</div><div class="w-sub">${pd}.</div><button class="act w-go" data-go="model">${ic('cube')} See it in the model</button>`,
      back:`<p>Lower Reach: four low-head dams out between Bridge and Fulton, replaced with rock. Sixth Street Dam stays until the federal Upper Reach study picks a new lamprey barrier. Nothing here is a daily construction log; check the city's project page for closures.</p>`, src:['Lower Reach project', 'https://engage.grandrapidsmi.gov/lowerreach']}); }
  el.innerHTML = h;
  const asof = document.getElementById('asof');
  if(asof) asof.innerHTML = LIVE.ok
    ? `${ic('gauge')} gauges read ${LIVE.at ? LIVE.at.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · checked ${ago(LIVE.read)}`
    : `${ic('warn')} live gauges unreachable`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.w-i'); if(b){ b.closest('.w').classList.toggle('flip'); return; }
  const g = e.target.closest('.w-go'); if(g){ const t = document.getElementById(g.dataset.go); if(t) t.scrollIntoView({behavior:'smooth', block:'start'}); }
});

function seasonNow(d = new Date()){
  const m = d.getMonth();
  if(m === 11 || m <= 1) return ['Winter','Cold water, ice possible, low biological activity. Thaw can spike stage fast.'];
  if(m <= 3) return ['Spring migration','Snowmelt and rain, cold-water danger, steelhead and sucker movement.'];
  if(m === 4) return ['Late spring','Nursery period, mussels active, recreation climbing.'];
  if(m <= 7) return ['Summer warmwater','Warmest water, thermal and oxygen stress at low flow, peak recreation.'];
  if(m <= 9) return ['Fall salmonid','Cooling water, Chinook and coho movement, leaf input, cleanup season.'];
  return ['Transition','Fast cooling, steelhead possible, construction winding down.'];
}

function phaseNow(d = new Date()){
  const t = d.getTime(), on = (y,mo,dd) => new Date(y, mo-1, dd).getTime();
  if(t < on(2026,5,18))  return ['Preconstruction','planned','Mobilisation expected 18 May 2026'];
  if(t < on(2026,7,1))   return ['Mobilisation','official','Staging at Ah-Nab-Awen. In-river work not before 1 July'];
  if(t < on(2026,12,1))  return ['In-river season 1','official','Four low-head dams coming out. Sixth Street Dam stays'];
  if(t < on(2027,4,15))  return ['Winter pause','planned','Work resumes when river level and weather allow'];
  if(t < on(2027,11,1))  return ['In-river season 2','planned','Target completion autumn 2027'];
  return ['Lower Reach complete','planned','Expected autumn 2027, water and weather dependent'];
}

/* one line of conditions, ready to paste anywhere */
function conditionLine(){
  const tempC = pick('tempC'), flow = pick('flow'), stage = pick('stage');
  const m = new Date().getMonth();
  if(!LIVE.ok) return `Grand River live gauge data is unavailable right now. Check ${GAUGES.npark.url}`;
  const bits = [];
  if(tempC) bits.push(`${fmt(cToF(tempC.v),1)}°F`);
  if(flow)  bits.push(`${fmt(flow.v)} cfs`);
  if(stage) bits.push(`gage ${fmt(stage.v,2)} ft`);
  const v = flowVerdict(flow?.v);
  return `Grand River at Grand Rapids: ${bits.join(', ')}`
       + (v ? `. Flow is ${v[0].toLowerCase()} for the date.` : '.')
       + ` Provisional USGS data read ${LIVE.at ? LIVE.at.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'just now'}.`;
}

/* ============================================================================
   SPECIES
   Photos come from the Wikipedia REST summary endpoint, which is CORS-open and
   returns a thumbnail plus a one-line description. We store only the page title,
   so images never rot the way hotlinked file URLs do.
   ========================================================================= */

const SPECIES = [
  /* fish, Great Lakes migrants */
  {n:'Chinook salmon',   w:'Chinook_salmon',    g:'fish', s:'Introduced', note:'Fall run. Enters late August as water cools, peaks September into October.'},
  {n:'Coho salmon',      w:'Coho_salmon',       g:'fish', s:'Introduced', note:'Fall run, peaks mid to late September. Do not assume Chinook timing.'},
  {n:'Steelhead',        w:'Rainbow_trout',     g:'fish', s:'Introduced', note:'Migratory rainbow trout. Fall through spring, biggest push late February to April.'},
  {n:'Lake sturgeon',    w:'Lake_sturgeon',     g:'fish', s:'Threatened', note:'About 100 individuals. Juveniles confirmed 2022, so the river reproduces its own. Never target.'},
  {n:'River redhorse',   w:'River_redhorse',    g:'fish', s:'Threatened', note:'Native large-river fish. A restoration target alongside sturgeon.'},
  {n:'Walleye',          w:'Walleye',           g:'fish', s:'Native',     note:'Year-round river use, spring spawning movements below dams.'},
  {n:'Smallmouth bass',  w:'Smallmouth_bass',   g:'fish', s:'Native',     note:'Warm season, around rock and current breaks. New boulders add habitat.'},
  {n:'Largemouth bass',  w:'Largemouth_bass',   g:'fish', s:'Native',     note:'Slower margins and backwaters, stronger in the lower river.'},
  {n:'Northern pike',    w:'Northern_pike',     g:'fish', s:'Native',     note:'Slower vegetated habitat in the wider system.'},
  {n:'Channel catfish',  w:'Channel_catfish',   g:'fish', s:'Native',     note:'Warm-season feeding in deeper, slower zones.'},
  {n:'Flathead catfish', w:'Flathead_catfish',  g:'fish', s:'Native',     note:'Large-river resident. Pools and slack water matter.'},
  {n:'White sucker',     w:'White_sucker',      g:'fish', s:'Native',     note:'Strong spring movement over gravel. An important, unglamorous migrant.'},
  {n:'Gizzard shad',     w:'Gizzard_shad',      g:'fish', s:'Native',     note:'Abundant forage fish. Big die-offs after sharp cold snaps.'},
  {n:'Pugnose shiner',   w:'Pugnose_shiner',    g:'fish', s:'Endangered', note:'State endangered. Needs clear water and healthy vegetation.'},
  {n:'Spotted gar',      w:'Spotted_gar',       g:'fish', s:'Concern',    note:'State special concern. Juveniles documented in a lower-river bayou.'},

  /* mussels */
  {n:'Snuffbox mussel',  w:'Epioblasma_triquetra', g:'mussel', s:'Federally endangered', note:'38 relocated from the Lower Reach in 2024. The flagship permit species.'},
  {n:'Purple wartyback', w:'Cyclonaias_tuberculata', g:'mussel', s:'State protected', note:'Among about 3,000 mussels moved below Knapp Street in July 2026.'},
  {n:'Freshwater mussels', w:'Unionidae',       g:'mussel', s:'Native',   note:'Filter bacteria, algae and sediment. They cannot move out of the way of an excavator.'},

  /* birds and mammals */
  {n:'Bald eagle',       w:'Bald_eagle',        g:'wild', s:'Recovered',  note:'Uses open-water reaches as a feeding and travel corridor.'},
  {n:'Great blue heron', w:'Great_blue_heron',  g:'wild', s:'Common',     note:'Favours shallows and slow edges.'},
  {n:'North American river otter', w:'North_American_river_otter', g:'wild', s:'Native', note:'Plausible in the wider system. Downtown sightings should be observation based.'},
  {n:'American mink',    w:'American_mink',     g:'wild', s:'Native',     note:'Bank hunter along the corridor.'},
  {n:'North American beaver', w:'North_American_beaver', g:'wild', s:'Native', note:'Corridor resident, shapes bank vegetation.'},
  {n:'Muskrat',          w:'Muskrat',           g:'wild', s:'Native',     note:'Common in slower vegetated water.'},
  {n:'Spiny softshell turtle', w:'Spiny_softshell_turtle', g:'wild', s:'Native', note:'Needs soft banks and sandbars, not hard floodwall edge.'},
  {n:'Northern map turtle', w:'Northern_map_turtle', g:'wild', s:'Native', note:'Basks on logs and rock in the main channel.'},
  {n:'Mudpuppy',         w:'Common_mudpuppy',   g:'wild', s:'Native',     note:'Fully aquatic salamander. Host for the salamander mussel.'},

  /* invasives */
  {n:'Sea lamprey',      w:'Sea_lamprey',       g:'inv', s:'Invasive', note:'Why Sixth Street Dam still matters. Any future design must keep a working barrier.'},
  {n:'Round goby',       w:'Round_goby',        g:'inv', s:'Invasive', note:'Great Lakes invader. Eats eggs and young, reshapes the food web.'},
  {n:'Zebra mussel',     w:'Zebra_mussel',      g:'inv', s:'Invasive', note:'Not a native unionid. Do not blur the two.'},
  {n:'Common carp',      w:'Common_carp',       g:'inv', s:'Invasive', note:'Long established. Stirs sediment and uproots vegetation.'},
  {n:'Eurasian watermilfoil', w:'Myriophyllum_spicatum', g:'inv', s:'Invasive', note:'Aquatic plant, forms dense mats in slow water.'},
  {n:'Purple loosestrife', w:'Lythrum_salicaria', g:'inv', s:'Invasive', note:'Bank and floodplain invader, crowds out native wetland plants.'},
  {n:'Phragmites',       w:'Phragmites',        g:'inv', s:'Invasive', note:'Tall reed that takes over bank and wetland edge.'}
];

const GROUPS = {fish:'Fish', mussel:'Mussels', wild:'Birds & mammals', inv:'Invasive'};

/* --- photo cache so we hit Wikipedia once per species per session --- */
const PHOTOS = {};

async function photo(title){
  if(PHOTOS[title] !== undefined) return PHOTOS[title];
  try{
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                          {headers:{'Accept':'application/json'}});
    if(!r.ok) throw 0;
    const j = await r.json();
    PHOTOS[title] = {
      img:  j.thumbnail?.source || j.originalimage?.source || null,
      desc: j.description || '',
      link: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`
    };
  }catch(e){ PHOTOS[title] = {img:null, desc:'', link:`https://en.wikipedia.org/wiki/${title}`}; }
  return PHOTOS[title];
}

/* first title in a list that has a photo */
async function photoAny(titles){
  const list = Array.isArray(titles) ? titles : [titles];
  let last = null;
  for(const t of list){ const p = await photo(t); if(p && p.img) return p; last = p; }
  return last;
}
function statusClass(s){
  if(/invasive/i.test(s)) return 'inv';
  if(/endangered|threatened|concern/i.test(s)) return 'rare';
  return '';
}

const artOf = sp => (typeof Life !== 'undefined' && Life.art && Life.art[sp.n]) ? Life.art[sp.n] : null;
function spCard(sp, id){
  const A = artOf(sp);
  const pic = A ? `<span class="ph art"><img src="${Life.artUrl(A.s, true)}" alt="${sp.n}" loading="lazy"></span>`
              : `<span class="ph load" data-w="${sp.w}" data-g="${sp.g}"></span>`;
  return `<button type="button" class="sp" id="${id}" data-sel="${sp.n}" title="${sp.note.replace(/"/g,'&quot;')}">
    ${pic}
    <span class="cap"><span class="nm">${sp.n}</span><span class="st ${statusClass(sp.s)}">${sp.s}</span></span>
  </button>`;
}
const GROUP_ICO = {fish:'fish', mussel:'shell', wild:'paw', inv:'bug'};
/* fill in photos after the cards are in the DOM, only for species without a painting */
async function hydrate(root){
  const slots = [...(root || document).querySelectorAll('.ph[data-w]')];
  await Promise.all(slots.map(async el => {
    const p = await photo(el.dataset.w);
    el.classList.remove('load');
    const g = el.dataset.g; el.removeAttribute('data-w');
    if(p && p.img){ el.style.backgroundImage = `url("${p.img}")`; el.classList.add('photo'); }
    else { el.classList.add('empty'); el.innerHTML = `<span class="ph-ico">${ic(GROUP_ICO[g] || 'fish')}</span>`; }
  }));
}
document.addEventListener('click', e => {
  const b = e.target.closest('.sp[data-sel]'); if(!b) return;
  if(typeof Life !== 'undefined'){ Life.select(b.dataset.sel); const w = document.getElementById('lifewidget'); if(w) w.scrollIntoView({behavior:'smooth', block:'start'}); }
});

let galFilter = 'all';
function renderGallery(){
  const gf = document.getElementById('galfilt');
  gf.innerHTML = `<button class="pill ${galFilter==='all'?'on':''}" data-g="all">All ${SPECIES.length}</button>`
    + Object.entries(GROUPS).map(([k,v]) =>
        `<button class="pill ${galFilter===k?'on':''}" data-g="${k}">${v}</button>`).join('');
  const list = SPECIES.filter(s => galFilter === 'all' || s.g === galFilter);
  const gal = document.getElementById('gal');
  gal.innerHTML = list.map((s,i) => spCard(s, 'sp-' + s.w)).join('');
  hydrate(gal);
}

/* --- detect species mentioned in an answer and append a photo strip --- */
const ALIASES = [
  ['Chinook salmon',['chinook','king salmon']], ['Coho salmon',['coho']],
  ['Steelhead',['steelhead','rainbow trout']],  ['Lake sturgeon',['sturgeon']],
  ['River redhorse',['redhorse']],              ['Walleye',['walleye']],
  ['Smallmouth bass',['smallmouth']],           ['Largemouth bass',['largemouth']],
  ['Northern pike',['northern pike']],          ['Channel catfish',['channel catfish']],
  ['Flathead catfish',['flathead']],            ['White sucker',['white sucker','sucker']],
  ['Gizzard shad',['gizzard shad']],            ['Pugnose shiner',['pugnose']],
  ['Spotted gar',['spotted gar']],
  ['Snuffbox mussel',['snuffbox']],             ['Purple wartyback',['wartyback']],
  ['Freshwater mussels',['mussel','mussels','unionid']],
  ['Bald eagle',['bald eagle','eagle']],        ['Great blue heron',['heron']],
  ['North American river otter',['otter']],     ['American mink',['mink']],
  ['North American beaver',['beaver']],         ['Muskrat',['muskrat']],
  ['Spiny softshell turtle',['softshell']],     ['Northern map turtle',['map turtle']],
  ['Mudpuppy',['mudpuppy']],
  ['Sea lamprey',['sea lamprey','lamprey']],    ['Round goby',['round goby','goby']],
  ['Zebra mussel',['zebra mussel']],            ['Common carp',['carp']],
  ['Eurasian watermilfoil',['watermilfoil','milfoil']],
  ['Purple loosestrife',['loosestrife']],       ['Phragmites',['phragmites']]
];

/* Category words map to a curated set, so "what fish are in the water" shows fish. */
const CATEGORIES = [
  [['fish','fishes','fishing','species of fish','what swims'],
   ['Chinook salmon','Coho salmon','Steelhead','Lake sturgeon','Walleye','Smallmouth bass',
    'Channel catfish','Northern pike','River redhorse','Gizzard shad']],
  [['salmon','salmon run'], ['Chinook salmon','Coho salmon','Steelhead']],
  [['bird','birds','birdlife'], ['Bald eagle','Great blue heron']],
  [['mammal','mammals'], ['North American river otter','American mink','North American beaver','Muskrat']],
  [['wildlife','animals','what lives','creatures'],
   ['Lake sturgeon','Freshwater mussels','Bald eagle','North American river otter','Spiny softshell turtle','Great blue heron']],
  [['invasive','invasives','invasive species'],
   ['Sea lamprey','Round goby','Zebra mussel','Common carp','Phragmites','Purple loosestrife']],
  [['turtle','turtles','reptile','reptiles','amphibian','amphibians'],
   ['Spiny softshell turtle','Northern map turtle','Mudpuppy']],
  [['endangered','threatened','protected','rare species'],
   ['Snuffbox mussel','Lake sturgeon','River redhorse','Pugnose shiner','Purple wartyback']]
];

function detect(text, cap = 8){
  const low = ' ' + text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ') + ' ';
  const has = k => low.includes(' ' + k + ' ') || low.includes(' ' + k + 's ');
  const out = [], push = name => {
    if(out.length >= cap || out.some(h => h.n === name)) return;
    const sp = SPECIES.find(s => s.n === name); if(sp) out.push(sp);
  };
  /* named species first, they are the most specific signal */
  for(const [name, keys] of ALIASES){ if(keys.some(has)) push(name); }
  /* then category words fill out the picture */
  for(const [keys, names] of CATEGORIES){ if(keys.some(has)) names.forEach(push); }
  return out;
}

function stripFor(text){
  const hits = detect(text);
  if(!hits.length) return '';
  return `<div class="strip">${hits.map(s => spCard(s, 'st-' + s.w + '-' + Math.random().toString(36).slice(2,6))).join('')}</div>`;
}

/* ============================================================================
   RIVER READER
   Andy Guy writes the Grand River Network dispatch. Every issue opens the same
   way: water temperature, flow, and whether that is above or below the seasonal
   average. That opener is the model for the conditions widget above.
   These are the issues on record. The weekly deep dive appends new ones.
   ========================================================================= */

const READER = [
  {d:'Jul 24, 2026', t:'Riverfront Bidding Battle',
   c:'72 °F, 1,300 cfs, well below the seasonal average for late July.',
   b:'Federal auction for the 3.5 acre former Marine Corps Reserve Center reached $2.8M after 47 bids, up 80 percent from the $1.525M opening. Ada, Plainfield and Ottawa County millages on the August 4 ballot all shape the Greenway. Trail construction underway on Cannonsburg Road. GRPM Grand River Adventure August 15. Ah-Nab-Awen was also a construction zone 47 years ago.'},

  {d:'Jul 10, 2026', t:'Another Mussel Move',
   c:'80 °F, 2,400 cfs, just below average for early July.',
   b:'Biologists relocated about 3,000 freshwater mussels below Knapp Street before bridge pier work, including the state-protected purple wartyback. The yellow "pool noodle" in the river is a turbidity curtain. LGROW Plaster Creek cleanup pulled seventeen shopping carts. Community members made what organisers believe is the world\u2019s largest cyanotype print on the Blue Bridge.'},

  {d:'Jun 26, 2026', t:'Bridging the Thornapple',
   c:'Ada sets a new greenway connection.',
   b:'Thornapple pedestrian bridge progress and Ada greenway trail work.'},

  {d:'Jun 12, 2026', t:'Lower Reach Begins',
   c:'In-river construction season opens.',
   b:'The Lower Reach dam removal gets underway after nearly twenty years of planning.'},

  {d:'May 29, 2026', t:'Patios Mean Progress',
   c:'Oxford overhaul in overdrive.',
   b:'Riverfront activation and the Oxford Trail rebuild.'},

  {d:'May 15, 2026', t:'A Gizzard What?',
   c:'Plus a major bridge milestone.',
   b:'Gizzard shad in the Grand, and a bridge milestone on the Greenway.'},

  {d:'May 1, 2026', t:'A Rare "Fish On!"',
   c:'Plus Plainfield\u2019s big dig.',
   b:'A rare catch on the Grand and Plainfield Township trail excavation.'},

  {d:'Apr 17, 2026', t:'A Big Dam Problem',
   c:'And more dam study.',
   b:'Sixth Street Dam condition and the federal barrier study.'},

  {d:'Apr 3, 2026', t:'Greenway Work Everywhere',
   c:'Construction season is here.',
   b:'Simultaneous greenway construction across the corridor.'},

  {d:'Feb 20, 2026', t:'Dam Good News',
   c:'Ready, set, slither.',
   b:'Funding and permitting progress, plus the snow snake competition.'},

  {d:'Jan 9, 2026', t:'WoW Starts Now',
   c:'Lyon gets lit.',
   b:'World of Winter opens downtown and Lyon Square lights up.'}
];

function renderReader(){
  document.getElementById('rr').innerHTML = READER.slice(0,6).map(r => `
    <div class="rr">
      <div class="d">${r.d}</div>
      <h4>${r.t}</h4>
      <p><strong>${r.c}</strong> ${r.b}</p>
    </div>`).join('')
    + `<div style="font:10.5px var(--mono);color:var(--muted);margin-top:6px">
         ${READER.length} issues on record. Every one opens with temperature, flow and how they compare to the season.
       </div>`;
}


/* ============================================================================
   THE RIVER, LAYER BY LAYER
   A digital model of the downtown Grand River, Ann Street to Wealthy Street,
   laid over real coordinates so it lines up with the map and the satellite
   photo. Scrub through time, peel down through the ground, tap anything.
   Depths are exaggerated. Bank shapes and structure positions are approximate.
   The live gauge is the only measured input.
   ========================================================================= */
const Twin = (() => {

/* ---------- model space ----------
   x is the station: 0 at Ann Street, 94 at Fulton Street, 116 at Wealthy.
   The station axis is stretched onto the real river centreline by xr().
   z runs across in station units: negative is the east bank, positive west.
   Across distances are scaled by ZS so the river comes out its real width.
   Elevations are kept in feet and multiplied by VY for display.       */
const X0 = -4, X1 = 124, Z0 = -56, Z1 = 56, BOTTOM = -70, SZ = 26;
const FT = 0.3048/36;        /* model units per foot at true scale (MPU is 36 m per unit) */
const DEEP = 5;              /* exaggeration below the riverbed, so the strata can be read */
const YDEEP = -8;            /* feet: everything below this is stretched */
const Y = ft => ft >= YDEEP ? ft*FT : YDEEP*FT + (ft - YDEEP)*FT*DEEP;
const VY = FT, VB = FT;      /* kept for the few linear uses above the bed */
const NX = 224, NZ = 112, WX = 448, WZ = 20;
const DATUM = 4.3;           /* gage height that lines up with the model's normal water */
const MPU = 36;              /* metres per model unit, along and across */
const ZS  = 0.284;           /* station z units to model units: 8.3 half-width becomes 85 m */

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp  = (a,b,t) => a + (b - a) * t;
const sm    = t => { t = clamp(t,0,1); return t*t*(3 - 2*t); };
const band  = (a,b,x) => sm((x - a) / (b - a));
function pl(pts, x){
  if(x <= pts[0][0]) return pts[0][1];
  for(let i = 1; i < pts.length; i++){
    if(x <= pts[i][0]){ const [a,ya] = pts[i-1], [b,yb] = pts[i]; return ya + (yb - ya) * (x - a) / (b - a); }
  }
  return pts[pts.length-1][1];
}
function hn(x, z){ const s = Math.sin(x*127.1 + z*311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z){
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
  return lerp(lerp(hn(xi,zi), hn(xi+1,zi), u), lerp(hn(xi,zi+1), hn(xi+1,zi+1), u), v);
}

/* ---------- geography ----------
   Crossings carry real coordinates (bridge midpoints, the dam, and estimates
   for the plain street bridges). The river centreline is a smooth curve through
   them, and every station is stretched onto it. */
const LAT0 = 42.9744, LNG0 = -85.6746;
const MLAT = 110950, MLNG = 111320*Math.cos(LAT0*Math.PI/180);
const XINGS = [
  ['Ann Street',          42.9955, -85.6722,   0, 'street'],
  ['Railroad bridge',     42.9905, -85.6730,   6, 'rail'],
  ['Leonard Street',      42.9866, -85.6734,  12, 'street'],
  ['Sixth Street Bridge', 42.9767, -85.6743,  26, 'iron'],
  ['Sixth Street Dam',    42.9744, -85.6746,  28, 'dam'],
  ['I-196',               42.9731, -85.6749,  34, 'freeway'],
  ['Bridge Street',       42.9703, -85.6753,  44, 'street'],
  ['Gillett Bridge',      42.96755,-85.6754,  65, 'arch'],
  ['Pearl Street',        42.9665, -85.6756,  76, 'street'],
  ['Blue Bridge',         42.9646, -85.6756,  84, 'blue'],
  ['Fulton Street',       42.9631, -85.6764,  94, 'street'],
  ['Wealthy Street',      42.9561, -85.6800, 116, 'street']
];
const toXZ = (lat, lng) => [(lng - LNG0)*MLNG/MPU, -(lat - LAT0)*MLAT/MPU];
const toLL = (X, Z) => [LAT0 - Z*MPU/MLAT, LNG0 + X*MPU/MLNG];
const CURVE = (() => {
  const P = XINGS.map(k => toXZ(k[1], k[2]));
  const ext = (p, q) => [p[0] + (p[0] - q[0])*1.5, p[1] + (p[1] - q[1])*1.5];
  const C = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])];
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t*t, t3 = t2*t;
    return [0.5*((2*p1[0]) + (-p0[0] + p2[0])*t + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0])*t2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0])*t3),
            0.5*((2*p1[1]) + (-p0[1] + p2[1])*t + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1])*t2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1])*t3)];
  };
  const pts = [], sAt = [], SEG = 48;
  for(let i = 0; i < C.length - 3; i++){
    for(let j = 0; j < SEG; j++) pts.push(cr(C[i], C[i + 1], C[i + 2], C[i + 3], j/SEG));
  }
  pts.push(cr(C[C.length - 4], C[C.length - 3], C[C.length - 2], C[C.length - 1], 1));
  const cum = [0];
  for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  for(let i = 0; i < P.length; i++) sAt.push(cum[i*SEG]);
  const s0 = sAt[0];
  return {pts, cum:cum.map(v => v - s0), sAt:sAt.map(v => v - s0), len:cum[cum.length - 1] - s0};
})();
/* old station to real station (model units along the curve), piecewise linear through the crossings */
const XR = XINGS.map((k, i) => [k[3], CURVE.sAt[i]]);
function xr(x){
  const n = XR.length;
  if(x <= XR[0][0]) return XR[0][1] + (x - XR[0][0])*(XR[1][1] - XR[0][1])/(XR[1][0] - XR[0][0]);
  if(x >= XR[n - 1][0]) return XR[n - 1][1] + (x - XR[n - 1][0])*(XR[n - 1][1] - XR[n - 2][1])/(XR[n - 1][0] - XR[n - 2][0]);
  return pl(XR, x);
}
function xo(s){
  const inv = XR.map(p => [p[1], p[0]]), n = inv.length;
  if(s <= inv[0][0]) return inv[0][1] + (s - inv[0][0])*(inv[1][1] - inv[0][1])/(inv[1][0] - inv[0][0]);
  if(s >= inv[n - 1][0]) return inv[n - 1][1] + (s - inv[n - 1][0])*(inv[n - 1][1] - inv[n - 2][1])/(inv[n - 1][0] - inv[n - 2][0]);
  return pl(inv, s);
}
/* position and downstream unit tangent at a real station */
function curveAt(s){
  const cum = CURVE.cum, pts = CURVE.pts, n = pts.length;
  let lo = 0, hi = n - 1;
  if(s <= cum[0]){ const t = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]], L = Math.hypot(t[0], t[1]) || 1;
    return {X:pts[0][0] + t[0]/L*(s - cum[0]), Z:pts[0][1] + t[1]/L*(s - cum[0]), tx:t[0]/L, tz:t[1]/L}; }
  if(s >= cum[n - 1]){ const t = [pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]], L = Math.hypot(t[0], t[1]) || 1;
    return {X:pts[n - 1][0] + t[0]/L*(s - cum[n - 1]), Z:pts[n - 1][1] + t[1]/L*(s - cum[n - 1]), tx:t[0]/L, tz:t[1]/L}; }
  while(hi - lo > 1){ const m = (lo + hi) >> 1; if(cum[m] <= s) lo = m; else hi = m; }
  const f = (s - cum[lo])/((cum[hi] - cum[lo]) || 1);
  const a = pts[Math.max(0, lo - 1)], b = pts[Math.min(n - 1, hi + 1)];
  const t = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(t[0], t[1]) || 1;
  return {X:pts[lo][0] + (pts[hi][0] - pts[lo][0])*f, Z:pts[lo][1] + (pts[hi][1] - pts[lo][1])*f, tx:t[0]/L, tz:t[1]/L};
}
/* station space to world: x old station, zR across in model units (positive west), yFt elevation in feet */
function Wr(x, zR, yFt){
  const c = curveAt(xr(x));
  return [c.X - c.tz*zR, Y(yFt || 0), c.Z + c.tx*zR];
}
const W = (x, z, yFt) => Wr(x, z*ZS, yFt);
/* world to station: nearest point on the centreline */
function inv(X, Z){
  const pts = CURVE.pts; let bi = 0, bd = Infinity;
  for(let i = 0; i < pts.length; i += 3){ const d = (pts[i][0] - X)**2 + (pts[i][1] - Z)**2; if(d < bd){ bd = d; bi = i; } }
  for(let i = Math.max(0, bi - 3); i <= Math.min(pts.length - 1, bi + 3); i++){ const d = (pts[i][0] - X)**2 + (pts[i][1] - Z)**2; if(d < bd){ bd = d; bi = i; } }
  const c = curveAt(CURVE.cum[bi]);
  const along = (X - c.X)*c.tx + (Z - c.Z)*c.tz, s = CURVE.cum[bi] + along;
  const c2 = curveAt(s), d = -(X - c2.X)*c2.tz + (Z - c2.Z)*c2.tx;
  return {s, x:xo(s), d, z:d/ZS};
}
const geoW = (lat, lng) => { const p = toXZ(lat, lng); return {X:p[0], Z:p[1], st:inv(p[0], p[1])}; };
/* Web Mercator pixel of a world point at a zoom level, for the map tiles */
function mercPx(X, Z, zoom){
  const [lat, lng] = toLL(X, Z), n = 256*Math.pow(2, zoom), la = lat*Math.PI/180;
  return [(lng + 180)/360*n, (1 - Math.log(Math.tan(la) + 1/Math.cos(la))/Math.PI)/2*n];
}

/* ---------- landmarks, placed by real coordinates ----------
   w and d are the footprint in metres (east-west, north-south), h the height. */
const LANDMARKS = [
  {k:'devos',   t:'DeVos Place',              lat:42.96898, lng:-85.67294, w:170, d:300, h:22,  era:[5,8], col:0xB7B1A2, wiki:'DeVos_Place_Convention_Center', y:'2003 to 2005',
   b:'Convention centre on the east bank with DeVos Performance Hall at its south end. Gillett Bridge lands at its river doors. The riverwalk runs along its west face.'},
  {k:'pantlind',t:'Amway Grand Plaza, Pantlind wing', lat:42.96650, lng:-85.67340, w:105, d:70, h:44, era:[3,8], col:0xC9B99D, wiki:'Amway_Grand_Plaza_Hotel', y:'1913',
   b:'The Pantlind Hotel opened in 1913 on the east bank at Pearl and Monroe. Restored and renamed the Amway Grand Plaza in 1981, it still anchors the downtown riverfront.'},
  {k:'amway',   t:'Amway Grand Plaza tower',   lat:42.96720, lng:-85.67405, w:42,  d:42,  h:139, era:[5,8], col:0x9FB2B8, wiki:'Amway_Grand_Plaza_Hotel', y:'1983',
   b:'The 29 storey glass tower on the riverbank, at about 456 feet the tallest building in Grand Rapids when it opened. The river view rooms look straight down at the Lower Reach work.'},
  {k:'jw',      t:'JW Marriott',               lat:42.96590, lng:-85.67420, w:55,  d:60,  h:85,  era:[5,8], col:0xA7B0A9, wiki:'JW_Marriott_Grand_Rapids', y:'2007',
   b:'23 storey hotel on the east bank between Pearl Street and the Blue Bridge. Its river terrace is one of the better vantage points for the Lower Reach.'},
  {k:'ford',    t:'Ford Presidential Museum',  lat:42.96841, lng:-85.67737, w:100, d:72,  h:12,  era:[5,8], col:0xB9B4A6, wiki:'Gerald_R._Ford_Presidential_Museum', y:'1981',
   b:'West bank, opened 1981. President Ford and Betty Ford are buried on the grounds overlooking the river. Ah-Nab-Awen Park sits between the museum and the water.'},
  {k:'grpm',    t:'Grand Rapids Public Museum', lat:42.96553, lng:-85.67690, w:52,  d:125, h:18,  era:[5,8], col:0xB3AC9C, wiki:'Grand_Rapids_Public_Museum', y:'1994',
   b:'West bank at Pearl Street, opened 1994 with the carousel pavilion out over the water. The Grand River Adventure event runs from its riverfront each August. Partner in the sturgeon work.'},
  {k:'bridgewater', t:'Bridgewater Place',     lat:42.97120, lng:-85.67650, w:46,  d:46,  h:83,  era:[5,8], col:0xA9ADAA, wiki:'Bridgewater_Place,_Grand_Rapids', y:'1993',
   b:'18 storey office tower on the west bank at Bridge Street, 272 feet to the roof. Its neighbour, River House, was built as the second phase.'},
  {k:'riverhouse', t:'River House',            lat:42.97095, lng:-85.67720, w:40,  d:40,  h:103, era:[5,8], col:0xB4B7B2, wiki:'River_House_Condominiums', y:'2008',
   b:'34 storey condominium tower on the west bank at Bridge Street, the tallest building in Grand Rapids at 338 feet.'},
  {k:'plaza',   t:'Plaza Towers',              lat:42.96367, lng:-85.67366, w:45,  d:45,  h:105, era:[5,8], col:0xB6B0A4, wiki:'Plaza_Towers_(Grand_Rapids)', y:'1991',
   b:'32 storey residential and hotel tower on the east bank at Fulton Street, about 344 feet, with the skywalk into downtown.'},
  {k:'eberhard',t:'Eberhard Center, GVSU',     lat:42.96442, lng:-85.67730, w:55,  d:52,  h:44,  era:[5,8], col:0xB0B4AE, wiki:'Robert_C._Pew_Grand_Rapids_Campus', y:'1988',
   b:'Grand Valley State University building on the west bank at Fulton Street, the first piece of the Pew campus. Its upper floors look down the Lower Reach.'},
  {k:'acrisure',t:'Acrisure Amphitheater',     lat:42.95950, lng:-85.67640, w:105, d:95,  h:26,  era:[6,8], col:0xC7B79A, wiki:'Acrisure_Amphitheater', y:'2026',
   b:'Outdoor amphitheater at 201 Market Avenue on the east bank below Fulton Street, opened May 15, 2026. The stage faces the river, so the river is the backdrop of every show.'},
  {k:'vanandel',t:'Van Andel Arena',           lat:42.96238, lng:-85.67158, w:140, d:120, h:32,  era:[5,8], col:0xB2ADA0, wiki:'Van_Andel_Arena', y:'1996',
   b:'Arena three blocks east of the river at Fulton Street, opened 1996. Not on the water, but it is the reason a lot of people walk across the Blue Bridge at night.'}
];

/* ---------- eras ---------- */
const ERAS = [
 {k:'1800', y:'Before 1826', t:'The rapids', c:'stable', reach:'MAINSTEM',
  ws:'natural', w:'natural', bank:'natural', bed:'natural', canal:false, water:0x5B9BE0, op:.66,
  body:`<p>The Grand dropped about 18 feet over roughly a mile here, spread across limestone ledges, gravel and boulder. That fast, shallow, loud water is the rapids the city is named for.</p><p>Anishinaabe people have lived, fished and traveled here for millennia, and they are still here. The Odawa name for the river, Owashtanong, means far-flowing water.</p>`,
  look:'white water across the whole reach, the ledges under it, the village marker'},
 {k:'1860', y:'1849 to 1880', t:'Water power', c:'stable', reach:'MAINSTEM',
  ws:'dam6', w:'natural', bank:'natural', bed:'natural', canal:true, water:0x4E8ED6, op:.72,
  body:`<p>A dam at Sixth Street and a mill canal turned the rapids into an industrial power system. A drop that once spread across a mile was held back and spent through mills.</p><p>On July 26, 1880, river water power lit the city with electricity, which the local historical commission counts as a national first.</p>`,
  look:'the dam, the canal along the east bank, the mills'},
 {k:'1883', y:'July 26, 1883', t:'The Great Log Jam', c:'stable', reach:'MAINSTEM',
  ws:'dam6', w:'natural', bank:'natural', bed:'natural', canal:true, water:0x5A88B8, op:.78,
  body:`<p>After two weeks of record rain, a jam about seven miles long broke loose above the Grand Trunk Railroad Bridge. Over 600,000 logs, about 150 million board feet, tore out every railroad bridge in the city.</p><p>Booms at Grand Haven stopped them short of Lake Michigan. No lives were lost. Within a few years the local lumber era was over.</p>`,
  look:'the logs, the broken railroad bridge'},
 {k:'1935', y:'1911 to 1931', t:'The engineered river', c:'stable', reach:'MAINSTEM',
  ws:'eng', w:'eng', bank:'urban', bed:'eng', canal:false, water:0x5F8FA6, op:.84,
  body:`<p>After the 1904 flood, the largest by volume at about 54,000 cfs, the city began floodwalls in 1911. Roughly 300,000 cubic yards of gravel, cobble and boulder were dredged out and used as riverfront fill, narrowing the channel.</p><p>Four low-head dams went in below Sixth Street between the 1920s and 1931. The rapids disappeared into a staircase of pools.</p>`,
  look:'the stepped water surface, the four dams, the floodwalls, the fill under the banks'},
 {k:'1969', y:'1969', t:'The low point', c:'stable', reach:'MAINSTEM',
  ws:'eng', w:'eng', bank:'urban', bed:'eng', canal:false, water:0x7A6E4A, op:.92,
  body:`<p>As much as 12.6 billion gallons of raw sewage entered the Grand in a single year. Combined sewers overflowed through outfalls in the walls every time it rained hard.</p><p>In the River for All outline this is the reckoning, the moment the river pushed back.</p>`,
  look:'the outfalls and their plumes, the colour of the water'},
 {k:'2015', y:'1991 to 2015', t:'Clean water', c:'stable', reach:'MAINSTEM',
  ws:'eng', w:'eng', bank:'urban', bed:'eng', canal:false, water:0x3E86D4, op:.76,
  body:`<p>A roughly $400 million sewer programme eliminated all 59 combined sewer overflow outfalls and laid about 119 miles of new pipe. The last outfall was sealed July 13, 2015, more than three years early.</p><p>The fish ladder at Sixth Street (1974) lets salmon and steelhead past the dam. In April 2013 the river crested at a record 21.85 ft and the walls held.</p>`,
  look:'the sealed outfalls, the fish ladder, the 2013 flood button'},
 {k:'2026', y:'2026, now', t:'Construction', c:'official', reach:'LOWER',
  ws:'eng', w:'eng', bank:'urban', bed:'eng', canal:false, water:0x3B7DD8, op:.8,
  body:`<p>The four low-head dams between Bridge Street and Fulton Street are coming out. Crews mobilised at Ah-Nab-Awen Park on May 18, and in-river work began July 1, a date set so Sixth Street keeps blocking sea lamprey.</p><p>Mussels were moved first. Work pauses for winter and resumes in 2027. This model does not track daily progress, so for which dams are out today, check official project updates.</p>`,
  look:'the causeways, the yellow turbidity curtains, the cofferdam, the staging area, the live gauge'},
 {k:'2027', y:'Fall 2027, expected', t:'Lower Reach restored', c:'planned', reach:'LOWER',
  ws:'restored', w:'eng', bank:'urban', bed:'restored', canal:false, water:0x3D8AD9, op:.7,
  body:`<p>The drop the four dams held is spread across two channel-wide rock grade-control structures, constructed riffles, more than 125 habitat boulders and three edge J-hooks. Rough water forms around rock, and it changes with flow.</p><p>There is no purpose-built surf wave. Sixth Street Dam still stands. Completion is expected fall 2027, water and weather permitting.</p>`,
  look:'the slope where the steps were, the boulder arches, the riffle, the J-hooks'},
 {k:'future', y:'After 2027', t:'Upper Reach, undecided', c:'scenario', reach:'UPPER',
  ws:'restored', w:'eng', bank:'urban', bed:'restored', canal:false, water:0x3D8AD9, op:.7,
  body:`<p>Sixth Street Dam is aging, and it is also the barrier that stops invasive sea lamprey. A federal Environmental Impact Statement led by the Great Lakes Fishery Commission with the Army Corps is weighing seven alternatives: no action, or a fixed or adjustable barrier at the present site, about half a mile upstream, or about a mile upstream.</p><p>Draft EIS anticipated July 2027. Nothing shown in violet has been chosen.</p>`,
  look:'the three violet barrier locations'}
];
const NOW_ERA = () => (Date.now() < new Date(2027,10,1).getTime() ? 6 : 7);

/* ---------- what each thing is, era by era ---------- */
const rng = (a,b) => i => i >= a && i <= b;
const INFO = {
  sixth:{t:'Sixth Street Dam', reach:'UPPER', c:i => i <= 5 ? 'stable' : i <= 7 ? 'official' : 'scenario', wiki:['Sixth_Street_Dam','Grand_Rapids_WhiteWater'],
    b:i => i <= 2
      ? `<p>The first dam at Sixth Street held the river back to feed the mill canal and power the growing city. The water-power era starts here.</p>`
      : i <= 7
      ? `<p>The biggest single drop in the downtown river, and today the first major barrier in this reach to invasive sea lamprey. That is why the Lower Reach project leaves it standing. Lamprey control is a governing Great Lakes fisheries requirement.</p>`
      : `<p>Still standing. Its future is the subject of the federal EIS. Until an alternative is selected, any removal or replacement is a scenario only.</p>`,
    ask:'Why does Sixth Street Dam stay while the four downstream dams come out?'},
  d4:{t:'Low-head dam 4, near Bridge Street', reach:'LOWER', c:i => i === 6 ? 'official' : 'stable',
    b:i => damText(i, 'After removal the bed upstream is regraded.'), ask:'What happens to low-head dam 4 near Bridge Street?'},
  d3:{t:'Low-head dam 3, below Bridge Street', reach:'LOWER', c:i => i === 6 ? 'official' : 'stable',
    b:i => damText(i, 'Removed outright in the Lower Reach work.'), ask:'What happens to low-head dam 3?'},
  d2:{t:'Low-head dam 2, above Gillett Bridge', reach:'LOWER', c:i => i === 6 ? 'official' : 'stable',
    b:i => damText(i, 'Its site becomes the main grade-control zone: three boulder arches and constructed riffles.'), ask:'What replaces low-head dam 2 above the Gillett Bridge?'},
  d1:{t:'Low-head dam 1, above Pearl Street', reach:'LOWER', c:i => i === 6 ? 'official' : 'stable',
    b:i => damText(i, 'Replaced by a constructed riffle and habitat boulders.'), ask:'What replaces low-head dam 1 above Pearl Street?'},
  canal:{t:'East side mill canal', reach:'DOWNTOWN', c:() => 'stable',
    b:() => `<p>Water taken from above the dam ran along the east bank to mills, which spent the head and returned it to the river. This is how the rapids became industrial power. The canal was later filled as the riverfront was built over.</p><p>Route and mill positions here are schematic.</p>`,
    ask:'How did the mill canals along the Grand work?'},
  walls:{t:'Floodwalls', reach:'DOWNTOWN', c:() => 'stable',
    b:() => `<p>Begun in 1911 after the 1904 flood. NWS thresholds at the Grand Rapids gauge: 12 ft bankfull, 18 ft flood, 21 ft moderate, 23 ft major. The record crest was 21.85 ft on April 21, 2013.</p><p>Restoration is modelled not to increase mapped flood risk. It does not eliminate flooding.</p>`,
    ask:'How high did the river get in the 2013 flood and what held it back?'},
  bSixth:{t:'Sixth Street Bridge, 1886', reach:'UPPER', c:() => 'stable', wiki:['Sixth_Street_Bridge_(Grand_Rapids,_Michigan)'],
    b:() => `<p>Wrought iron, 1886, a designated historic landmark. A pedestrian crossing just below the dam, with the best view of the fish ladder.</p>`, ask:'Tell me about the Sixth Street Bridge.'},
  bBlue:{t:'Blue Bridge, 1892', reach:'LOWER', c:() => 'stable', wiki:['Blue_Bridge_(Grand_Rapids,_Michigan)','Blue_Bridge_(Grand_Rapids)'],
    b:i => i <= 4
      ? `<p>The Grand Rapids and Indiana Railroad span, about 575 ft, one of Michigan's longest truss bridges. In this era it still carries trains.</p>`
      : `<p>The 1892 Grand Rapids and Indiana Railroad span, about 575 ft, one of Michigan's longest truss bridges. Converted to pedestrian use in the 1980s and painted its signature blue. A World of Winter hotspot.</p>`,
    ask:'What is the history of the Blue Bridge?'},
  bGillett:{t:'Gillett Bridge, 1915', reach:'LOWER', c:i => i === 6 ? 'official' : 'stable',
    b:i => `<p>Built as an interurban railway crossing, now a pedestrian bridge between Lyon Square and Ah-Nab-Awen Park.</p>` + (i === 6 ? `<p>It stays open during Lower Reach construction, and it is the closest public view of the work.</p>` : ''),
    ask:'Tell me about the Gillett Bridge.'},
  bBridge:{t:'Bridge Street', reach:'LOWER', c:() => 'stable', b:() => `<p>The upstream end of the Lower Reach. Everything from here to Fulton Street is the 2026 to 2027 restoration.</p>`, ask:'Where exactly is the Lower Reach?'},
  bPearl:{t:'Pearl Street', reach:'LOWER', c:() => 'stable', b:() => `<p>The Ford Presidential Museum sits on the west bank just upstream. Low-head dam 1 stood just above this bridge.</p>`, ask:'What is near the Pearl Street bridge on the river?'},
  bFulton:{t:'Fulton Street', reach:'LOWER', c:() => 'stable', b:() => `<p>The downstream end of the Lower Reach.</p>`, ask:'What is the downstream end of the Lower Reach?'},
  bLeonard:{t:'Leonard Street', reach:'UPPER', c:() => 'stable', b:() => `<p>In the Upper Reach, above Sixth Street Dam. Any future barrier option upstream would sit in this stretch.</p>`, ask:'What is happening in the Upper Reach above Sixth Street?'},
  rail:{t:'Railroad bridge, 1883', reach:'MAINSTEM', c:() => 'stable',
    b:() => `<p>The jam tore out every railroad bridge in the city. Position shown is schematic.</p>`, ask:'What did the 1883 log jam destroy?'},
  ladder:{t:'Fish ladder, 1974', reach:'UPPER', c:() => 'stable', wiki:['Fish_Ladder_Park','Fish_Ladder_Sculpture'],
    b:() => `<p>Designed by artist Joseph Kinnebrew. It lets migrating Chinook, coho and steelhead climb past Sixth Street Dam. Fishing is not allowed inside the ladder; anglers use the walkway for access.</p><p>Salmon typically run September into October. Steelhead peak in November and again from late February to April.</p>`,
    ask:'When is the best time to see fish jumping at the fish ladder?'},
  logs:{t:'The jam', reach:'MAINSTEM', c:() => 'stable',
    b:() => `<p>Over 600,000 logs, about 150 million board feet, broke loose on July 26, 1883. Stewart Edward White later put the mass at 37 million tons. Captain John Walsh, a one-armed pile-driver operator, drove the pilings credited with saving the timber, and got a gold watch for it.</p>`,
    ask:'Tell me the story of the Great Log Jam of 1883 in Grand Rapids.'},
  outfalls:{t:'Combined sewer outfalls', reach:'DOWNTOWN', c:() => 'stable',
    b:i => i <= 4
      ? `<p>When heavy rain overloaded combined sewers, raw sewage and stormwater spilled into the river through outfalls like these. In 1969 as much as 12.6 billion gallons entered the river in one year.</p><p>Positions shown are schematic.</p>`
      : `<p>Sealed. The city eliminated all 59 by 2015; the last was closed July 13, 2015, at Washington and Lafayette. Urban stormwater, road salt and sediment still reach the river.</p>`,
    ask:'How did Grand Rapids stop sewage going into the river?'},
  mussels:{t:'Mussel beds', reach:'LOWER', c:i => i === 6 ? 'official' : i >= 7 ? 'planned' : 'stable',
    b:i => i <= 5
      ? `<p>Freshwater mussels live in and on the bed, filtering bacteria, algae and fine sediment. Many need a specific host fish to carry their larvae, which ties fish passage to mussel survival.</p>`
      : i === 6
      ? `<p>Moved before the machines arrived: 9,040 mussels from about 45,000 square metres in 2024, including 38 federally endangered snuffbox. About 3,000 more, including the state-protected purple wartyback, came out below Knapp Street in July 2026.</p>`
      : `<p>Recolonisation takes years. A good-looking new riffle is not proof the mussel community has come back.</p>`,
    ask:'What happened to the mussels in the Grand River?'},
  causeway:{t:'Temporary rock causeways', reach:'LOWER', c:() => 'official',
    b:() => `<p>Excavators work off rock causeways built out into the river, which squeeze the flow into narrower paths around the work. They come out when the work is done. Locations here are schematic.</p>`,
    ask:'What are the rock causeways in the river for?'},
  curtain:{t:'Turbidity curtain', reach:'LOWER', c:() => 'official',
    b:() => `<p>The big yellow "pool noodle" in the river. It holds construction sediment inside the work zone. Brown water behind it is construction turbidity under monitoring, not a spill.</p>`,
    ask:'What is the yellow pool noodle floating in the Grand River?'},
  cofferdam:{t:'Cofferdam', reach:'LOWER', c:() => 'official',
    b:() => `<p>A temporary watertight enclosure that lets crews work in the dry on part of the bed. One went in on July 8. Location shown is schematic.</p>`,
    ask:'What is a cofferdam and why is one in the river?'},
  equipment:{t:'Excavators and rock delivery', reach:'LOWER', c:() => 'official',
    b:() => `<p>Diesel engines, backup alarms and rock placement are the soundtrack of this phase. Rain does not automatically stop work. The work zone is closed to the public; the bridges are the viewpoints.</p>`,
    ask:'What should a visitor know about the Lower Reach construction site?'},
  staging:{t:'Ah-Nab-Awen staging area', reach:'DOWNTOWN', c:() => 'official',
    b:() => `<p>Primary staging for the Lower Reach, closed to the public during this phase. Forty-seven years ago it was also a construction zone.</p>`,
    ask:'What is happening at Ah-Nab-Awen Park?'},
  arches:{t:'Boulder arches, main grade-control zone', reach:'LOWER', c:() => 'planned',
    b:() => `<p>Three boulder arches and constructed riffles where dam 2 stood. They hold the grade the dams used to hold, but as velocity diversity, eddies and seams instead of one straight drop.</p><p>Positions follow the project's feature table and are schematic.</p>`,
    ask:'How do the boulder arches replace the dams?'},
  riffle:{t:'Constructed riffle', reach:'LOWER', c:() => 'planned',
    b:() => `<p>Where dam 1 stood above Pearl Street. Shallow fast water over rock, the habitat suckers, redhorse and smallmouth use.</p>`,
    ask:'What is a constructed riffle?'},
  boulders:{t:'Habitat boulders, 125 plus', reach:'LOWER', c:() => 'planned',
    b:() => `<p>Scattered boulders make current breaks, eddies and resting pockets for fish, and surfaces for algae and insect larvae. At low flow their tops show. At high flow they hide and the river reads as broad and continuous.</p>`,
    ask:'What will the restored river look like at low, medium and high flow?'},
  jhooks:{t:'Edge J-hook structures', reach:'LOWER', c:() => 'planned',
    b:() => `<p>Three bank-edge rock structures between Pearl and Fulton. They turn current off the bank and scour pools behind them.</p>`,
    ask:'What are J-hook structures in a river?'},
  sturgeon:{t:'Sturgeon and redhorse habitat', reach:'LOWER', c:() => 'seasonal',
    b:() => `<p>Rock, riffles and velocity diversity target lake sturgeon (state threatened, about 100 estimated in the river) and river redhorse. Juveniles confirmed in 2022 prove the river reproduces sturgeon.</p><p>Presence on any given day is probable, not observed. Spring is the likely spawning window.</p>`,
    ask:'Are there lake sturgeon in the Grand River?'},
  optNow:{t:'Barrier option: present site', reach:'UPPER', c:() => 'scenario',
    b:() => optText('at the present Sixth Street location'), ask:'What are the Upper Reach alternatives in the federal EIS?'},
  optHalf:{t:'Barrier option: about half a mile upstream', reach:'UPPER', c:() => 'scenario',
    b:() => optText('about half a mile upstream'), ask:'What are the Upper Reach alternatives in the federal EIS?'},
  optMile:{t:'Barrier option: about a mile upstream', reach:'UPPER', c:() => 'scenario',
    b:() => optText('about a mile upstream'), ask:'What are the Upper Reach alternatives in the federal EIS?'},
  gauge:{t:'Staff gauge', reach:'MAINSTEM', c:i => i === 6 ? 'live' : 'stable',
    b:i => `<p>Reads gage height at USGS 04119000, Grand River at Grand Rapids. Gage height is water surface above a datum, not river depth. Bands mark NWS thresholds: 12 ft bankfull, 18 flood, 21 moderate, 23 major. The 2013 record, 21.85 ft, is marked.</p>`
      + (i === 6 ? `<p id="tw-gauge-live">${liveLine()}</p>` : '')
      + `<p>The gauge's position here is schematic.</p>`,
    ask:'What does the river gauge say right now?'},
  village:{t:'Odawa village at the rapids', reach:'MAINSTEM', c:() => 'stable',
    b:() => `<p>The main Odawa village stood at what is now downtown Grand Rapids. Nineteen Ottawa chiefs governed lands along the river from Lake Michigan to Lansing. Hopewell burial mounds downstream are about 2,000 years old.</p>`,
    ask:'What is the Indigenous history of the Grand River at the rapids?'},
  homeland:{t:'Anishinaabe homeland', reach:'MAINSTEM', c:() => 'stable',
    b:() => `<p>Indigenous presence did not end with settlement. The Grand River Bands of Ottawa Indians are a current community, and the Homecoming of the Three Fires gathers at Riverside Park each June.</p>`,
    ask:'Tell me about the Grand River Bands of Ottawa Indians today.'},
  ford:{t:'Ford Presidential Museum', reach:'DOWNTOWN', c:() => 'stable',
    b:() => `<p>West bank, opened 1981. Gerald and Betty Ford are buried on the grounds overlooking the river.</p>`, ask:'What is on the riverfront near the Ford Museum?'},
  grpm:{t:'Grand Rapids Public Museum', reach:'DOWNTOWN', c:() => 'stable',
    b:() => `<p>West bank. A partner in the lake sturgeon research, and host of the Grand River Adventure each August.</p>`, ask:'What does the Grand Rapids Public Museum do for the river?'},
  lyon:{t:'Lyon Square', reach:'DOWNTOWN', c:() => 'official',
    b:() => `<p>East bank landing of the Gillett Bridge. A new riverfront plaza, built alongside the river work, with an apprenticeship programme attached.</p>`, ask:'What is the Lyon Square project?'},
  anab:{t:'Ah-Nab-Awen Park', reach:'DOWNTOWN', c:() => 'stable', wiki:['Ah-Nab-Awen_Park'],
    b:() => `<p>West bank park between the Gillett Bridge and Pearl Street, next to the Ford Museum. It became the Lower Reach staging area in 2026.</p>`, ask:'What is happening at Ah-Nab-Awen Park?'},
  rapids:{t:'The rapids', reach:'MAINSTEM', c:() => 'stable',
    b:() => `<p>About 18 feet of fall over roughly a mile, broken into many small drops by limestone ledges. No single step, and white water nearly bank to bank.</p>`, ask:'What did the original rapids in Grand Rapids look like?'},
  water:{t:'Water', reach:'MAINSTEM', c:i => i === 6 ? 'live' : 'stable',
    b:i => `<p>Depth varies across the channel and changes with flow. Here it is drawn schematically.</p>` + (i === 6 ? `<p>${liveLine()}</p>` : ''),
    ask:'What is the river doing right now?'},
  /* layers under the ground */
  'L-bed':{t:'Riverbed', reach:'MAINSTEM', c:() => 'stable',
    b:i => i <= 2
      ? `<p>Limestone ledges, gravel, cobble and boulder. This coarse bed spread the drop and made the rapids.</p>`
      : i <= 6
      ? `<p>Much of the coarse bed was dredged out; roughly 300,000 cubic yards became riverfront fill. Finer sediment settled into the pools behind the dams.</p>`
      : `<p>Placed rock, a graded bed and boulders rebuild coarse habitat. Mussels live in the top of this layer.</p>`,
    ask:'What is the bottom of the Grand River made of?'},
  'L-cap':{t:'Ground surface', reach:'DOWNTOWN', c:() => 'stable',
    b:i => i <= 2 ? `<p>Soil and vegetation over river deposits.</p>` : `<p>Paving, park and buildings over riverfront fill.</p>`, ask:'How was the downtown riverfront built up?'},
  'L-fill':{t:'Riverfront fill', reach:'DOWNTOWN', c:() => 'stable',
    b:() => `<p>Roughly 300,000 cubic yards of gravel, cobble and boulder dredged from the river and used to build up and extend the banks. It narrowed the channel and raised the riverfront. It is why restoration is not uncovering a hidden pristine river.</p>`,
    ask:'What happened to the gravel dredged out of the Grand River?'},
  'L-alluvium':{t:'River and glacial deposits', reach:'BASIN', c:() => 'stable',
    b:() => `<p>Sand, gravel and silt laid down by the river and by meltwater at the end of the last ice age.</p>`, ask:'How did glaciers shape the Grand River valley?'},
  'L-lime':{t:'Limestone bedrock', reach:'BASIN', c:() => 'stable',
    b:() => `<p>Mississippian-age limestone, the rock the rapids ran over. Its ledges are why this stretch fell fast and loud.</p><p>Turn off Sediment and fill to see the rock surface on its own.</p>`, ask:'What rock is under the Grand River in Grand Rapids?'},
  'L-shale':{t:'Michigan Formation', reach:'BASIN', c:() => 'stable',
    b:() => `<p>Layers of shale, limestone and gypsum beneath the limestone. Grand Rapids sits on one of North America's richest gypsum deposits. Mining began near Plaster Creek around 1841.</p>`, ask:'Why is there so much gypsum under Grand Rapids?'},
  'L-gypsum':{t:'Gypsum beds', reach:'BASIN', c:() => 'stable',
    b:() => `<p>The gypsum that made Grand Rapids a plaster town. It was quarried and mined from the 1840s on.</p>`, ask:'Tell me about gypsum mining in Grand Rapids.'},
  'L-mine':{t:'Gypsum mine tunnels', reach:'BASIN', c:() => 'stable',
    b:() => `<p>Up to about six miles of tunnels roughly 85 to 100 feet down, under parts of the metro area, mostly southwest of downtown. Later used for mushroom farming, microfilmed legal records for about 70 percent of Michigan's counties, a data centre and Founders beer.</p><p>Drawn schematically, not to position.</p>`,
    ask:'What is in the old gypsum mines under Grand Rapids?'}
};
for(const L of LANDMARKS){
  INFO[L.k] = {t:L.t, reach:'DOWNTOWN', c:() => 'stable', wiki:L.wiki, y:L.y,
    b:() => `<p>${L.b}</p>`, ask:`Tell me about ${L.t} in Grand Rapids and how it relates to the river.`};
}
Object.assign(INFO, {
  bLeonard:{t:'Leonard Street Bridge', reach:'UPPER', c:() => 'stable', b:() => `<p>The first Leonard Street bridge was a covered toll bridge finished October 21, 1858, made free when the city bought it in 1873. The modern concrete bridge carries Leonard Street over the river above the Sixth Street pool.</p>`, ask:'What is the history of the Leonard Street bridge in Grand Rapids?'},
  bAnn:{t:'Ann Street Bridge', reach:'UPPER', c:() => 'stable', b:() => `<p>The northern edge of the model. Above here the river bends north east toward Riverside Park and Comstock Park.</p>`, ask:'What is the Grand River like at Ann Street in Grand Rapids?'},
  bRail:{t:'Railroad bridge', reach:'UPPER', c:() => 'stable', b:() => `<p>A rail bridge has crossed here since 1858, when the Detroit and Milwaukee Railway connected Detroit to the Grand Haven port. The 1906 steel bridge, 675 feet long, is still used by the Grand Rapids and Eastern.</p>`, ask:'What is the history of the railroad bridge over the Grand River between Leonard and Ann Street?'},
  bI196:{t:'I-196 bridge', reach:'UPPER', c:() => 'stable', b:() => `<p>The Gerald R. Ford Freeway crosses just below the dam and the fish ladder. The Lower Reach project starts about 300 feet upstream of Bridge Street, so this is the seam between the two projects.</p>`, ask:'Where does the I-196 freeway cross the Grand River in Grand Rapids?'},
  bBridge:{t:'Bridge Street Bridge', reach:'LOWER', c:() => 'stable', b:() => `<p>Bridge Street on the west bank becomes Michigan Street on the east. The 1988 concrete bridge replaced a 1907 arch bridge. The Lower Reach construction zone begins a few hundred feet upstream.</p>`, ask:'What is the history of the Bridge Street bridge over the Grand River in Grand Rapids?'},
  bPearl:{t:'Pearl Street Bridge', reach:'LOWER', c:() => 'stable', b:() => `<p>The first Pearl Street bridge opened November 25, 1858 across an island that has since been dredged away. Today's bridge sits between the Public Museum and the Amway Grand Plaza. Dam 1 was just upstream.</p>`, ask:'What is the history of the Pearl Street bridge in Grand Rapids?'},
  bFulton:{t:'Fulton Street Bridge', reach:'LOWER', c:() => 'stable', wiki:['Fulton_Street_Bridge_(Grand_Rapids,_Michigan)'], b:() => `<p>Open spandrel concrete arch, 536 feet, dedicated September 29, 1928 and on the National Register. The Lower Reach project ends here, and the USGS discharge gauge reads nearby.</p>`, ask:'What is the history of the Fulton Street bridge over the Grand River?'},
  bWealthy:{t:'Wealthy Street Bridge', reach:'MAINSTEM', c:() => 'stable', b:() => `<p>The southern edge of the model, below the amphitheater. Downstream the river bends west under US-131 and slows toward Grandville and Lake Michigan.</p>`, ask:'What is the Grand River like at Wealthy Street below downtown Grand Rapids?'},
  building:{t:'Downtown building', reach:'DOWNTOWN', c:() => 'stable', b:() => `<p>A building footprint from OpenStreetMap, extruded to its mapped height or its floor count. Downtown rises east of the river toward the hill; the west side stays lower and flatter.</p>`, ask:'What is along the river in downtown Grand Rapids?'},
  street:{t:'Street', reach:'DOWNTOWN', c:() => 'stable', b:() => `<p>Downtown streets run true east and west, so every bridge crosses the river at a slight skew to the current.</p>`, ask:'Which streets cross the Grand River in downtown Grand Rapids?'},
  park:{t:'Riverfront park', reach:'DOWNTOWN', c:() => 'stable', b:() => `<p>Ah-Nab-Awen Park, Canal Park, Sixth Street Park, Fish Ladder Park and Lyon Square are the public edges of the downtown river. The Riveredge Trail links most of them.</p>`, ask:'What parks are along the Grand River in downtown Grand Rapids?'},
  oldtown:{t:'Early downtown', reach:'DOWNTOWN', c:() => 'stable', b:() => `<p>By the 1910s the east bank held hotels, mills and warehouses between Michigan and Fulton, while the west side was factories, rail yards and worker housing. The Pantlind Hotel opened in 1913.</p>`, ask:'What did downtown Grand Rapids along the river look like in the early 1900s?'}
});
function damText(i, after){
  return `<p>One of four low-head dams installed between the 1920s and 1931. Low-head dams make recirculating rollers at their base that trap swimmers, and they block fish passage.</p>`
    + (i === 6 ? `<p>Being removed in the 2026 to 2027 Lower Reach work. ${after}</p>` : `<p>${after}</p>`);
}
function optText(where){
  return `<p>One of the barrier locations under study in the federal EIS: a fixed or adjustable sea lamprey barrier ${where}. Not selected. The Draft EIS is anticipated July 2027.</p><p>Shown in violet because it is a scenario, not a plan.</p>`;
}
function liveLine(){
  try{
    if(typeof LIVE === 'undefined' || !LIVE.ok) return 'Live gauge readings are unavailable right now.';
    return conditionLine();
  }catch(e){ return 'Live gauge readings are unavailable right now.'; }
}

/* ---------- water surface profiles, feet above normal water at Fulton ---------- */
const WS = {
  natural: [[-4,21.3],[20,19.5],[30,17],[45,13],[60,8.5],[75,4.5],[90,1.2],[104,0],[124,-1.4]],
  dam6:    [[-4,22.6],[27.6,22],[28.4,16.9],[45,13],[60,8.5],[75,4.5],[90,1.2],[104,0],[124,-1.4]],
  eng:     [[-4,22.6],[27.6,22],[28.4,13.5],[46.6,13.2],[47.4,10.8],[52.6,10.6],[53.4,8.4],
            [60.6,8.2],[61.4,5.2],[71.6,5.0],[72.4,2.4],[104,0],[124,-1.4]],
  restored:[[-4,22.6],[27.6,22],[28.4,13.5],[45,13.2],[50,11.9],[56,10.3],[58,9.8],[64,6.5],
            [70,5.4],[71,5.2],[74,3.5],[80,2.6],[90,1.2],[104,0],[124,-1.4]],
  flood:   []
};
WS.flood = [-4,0,8,16,24,27.5,30,36,42,46,50,56,62,66,70,74,78,82,88,94,100,110,124].map(x => [x, 0.6*pl(WS.eng, x) + 17.4]);
const BED_E = [[-4,14.4],[27,12.5],[28.4,7.2],[46,6.4],[72,1.0],[104,-5],[124,-6.6]];
const DAMS = [['d4',47],['d3',53],['d2',61],['d1',72]];

const cz = () => 0;
function halfW(x, w){
  const nat = 11.2 + 1.1*Math.sin(x*0.09) + 0.7*Math.sin(x*0.23 + 1.3) + (x > 30 && x < 92 ? 1.0 : 0);
  if(w === 'natural') return nat;
  const eng = 8.3 + 0.25*Math.sin(x*0.11) - 0.9*Math.exp(-Math.pow((x - 80)/5, 2));
  return lerp(nat - 0.8, eng, band(10, 18, x));
}
function ledge(x){ const f = (x*0.42) % 1; return -0.9*f*f; }
const bedN = x => pl(WS.natural, x) - 3.0 + ledge(x);
const bedE = x => pl(BED_E, x);
function poolR(x){
  let v = 0;
  for(const [c,a] of [[52,1],[67,1],[78,.8],[96,.9]]) v = Math.max(v, a*Math.exp(-Math.pow((x - c)/3.5, 2)));
  return v;
}
function bedR(x){
  if(x < 44) return bedE(x);
  const b = pl(WS.restored, x) - (2.2 + 2.4*poolR(x));
  return x < 46 ? lerp(bedE(x), b, band(44, 46, x)) : b;
}
function bedOf(x, kind){ return kind === 'natural' ? bedN(x) : kind === 'restored' ? bedR(x) : bedE(x); }
/* the limestone surface does not change with the eras */
function rockTop(x, d){
  return Math.min(bedN(x) - 3.2, bedE(x) - 1.2, bedR(x) - 1.2) + 0.6*ledge(x*1.3) - 0.05*d;
}
function bankTop(x, kind, side){
  const nat = pl(WS.natural, x) + 12 + (side < 0 ? 1.5 : 0);
  if(kind === 'natural') return nat;
  return Math.max(nat, 15 + 0.6*pl(WS.eng, x) + (side < 0 ? 0.5 : 0));
}
const rampW  = (x, e) => e.w === 'natural' ? 3.2 : lerp(2.0, 0.35, band(12, 18, x));
const waterExt = (x, e) => e.w === 'natural' ? 1.8 : lerp(1.1, 0.25, band(12, 18, x));
const canalZ = x => cz(x) - (halfW(x, 'natural') + 4.5);
const canalWs = x => pl([[28.6,21.7],[60,19.8]], x);
const hasWalls = (x, e) => e.w !== 'natural' && x > 16;

function wsFt(x, e, S){
  let y = pl(WS[e.ws], x);
  const f = S ? S.floodK : 0;
  if(f > 0) y = lerp(y, Math.max(y, pl(WS.flood, x)), f);
  return y;
}
function slopeAt(x, e){ return Math.abs(pl(WS[e.ws], x + 0.25) - pl(WS[e.ws], x - 0.25)) / 0.5; }

function groundFt(x, z, e, sed){
  const c = cz(x), d = Math.abs(z - c), side = z < c ? -1 : 1;
  if(!sed) return rockTop(x, d);
  const hw = halfW(x, e.w), b = bedOf(x, e.bed);
  const bowl = e.bed === 'natural' ? 1.8 : e.bed === 'restored' ? 1.6 : 1.2;
  if(d < hw){
    const u = d / hw;
    let micro = 0;
    if(e.bed === 'natural') micro = 0.35*(vn(x*1.7, z*1.7) - .5);
    else if(e.bed === 'restored' && x > 44) micro = 0.5*(vn(x*2.1, z*2.1) - .5);
    else micro = 0.12*(vn(x*1.3, z*1.3) - .5);
    return b + bowl*u*u + micro;
  }
  const R = rampW(x, e), edge = b + bowl, bt = bankTop(x, e.bank, side);
  let y = d < hw + R ? edge + (bt - edge)*sm((d - hw)/R)
                     : bt + (e.bank === 'natural' ? 0.8*(vn(x*0.6, z*0.6) - .5) : 0.05*(vn(x, z) - .5));
  if(e.canal && x > 28.6 && x < 60){
    const q = Math.abs(z - canalZ(x));
    if(q < 1.3) y = lerp(Math.min(y, canalWs(x) - 2.6), y, band(0.75, 1.3, q));
  }
  return y;
}

/* ---------- colours, 0..1 rgb ---------- */
const hex = h => [((h >> 16) & 255)/255, ((h >> 8) & 255)/255, (h & 255)/255];
const C = {
  lime:hex(0xA9A597), limeD:hex(0x86837A), limeL:hex(0xBFBBAD),
  gravel:hex(0x9E8C6A), gravelL:hex(0xB5A585), silt:hex(0x7A705C), sludge:hex(0x5E5540),
  cobble:hex(0x9B9484), cobbleL:hex(0xB4AE9F),
  sand:hex(0xC9B58C), grass:hex(0x94B877), grassL:hex(0xA9C98C), forest:hex(0x739F5E),
  concrete:hex(0xBDB7A8), paving:hex(0xD6D0C2), pavingL:hex(0xDED8CB), walk:hex(0xCCC6B8),
  park:hex(0x8FBB72), parkL:hex(0xA3C986), staging:hex(0xBBA67F), soil:hex(0x8C7355),
  fill:hex(0x6E5846), fillL:hex(0x806A55), alluvium:hex(0xAE8F5E), shale:hex(0x4B5350),
  shaleD:hex(0x3F4644), gyp:hex(0xE2DDCE), mineVoid:hex(0x121615)
};
const mix = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];

function groundColor(x, z, e, i, sed){
  const c = cz(x), d = Math.abs(z - c), side = z < c ? -1 : 1, hw = halfW(x, e.w);
  const n = vn(x*0.8, z*0.8), f = hn(Math.round(x*2), Math.round(z*2));
  if(!sed){
    const l = ledge(x*1.3);
    return mix(mix(C.limeL, C.limeD, clamp(-l*1.2, 0, 1)), C.lime, n*0.5);
  }
  if(d < hw){
    if(e.bed === 'natural') return mix(mix(C.gravel, C.lime, clamp(-ledge(x)*1.1 + n*0.4 - 0.2, 0, 1)), C.gravelL, f*0.35);
    if(e.bed === 'restored' && x > 44) return mix(C.cobble, C.cobbleL, clamp(n*0.7 + f*0.4, 0, 1));
    return mix(i === 4 ? C.sludge : C.silt, C.gravel, n*0.35);
  }
  const R = rampW(x, e);
  if(d < hw + R){
    if(e.w === 'natural') return mix(C.sand, C.grass, sm((d - hw)/R));
    return C.concrete;
  }
  if(e.bank === 'natural') return mix(mix(C.grass, C.forest, n), C.grassL, f*0.25);
  const back = d - hw - R;
  if(back < 1.3 && hasWalls(x, e)) return C.walk;
  /* Ah-Nab-Awen, west bank, Gillett to Pearl */
  if(side > 0 && x > 64 && x < 77 && back < 10){
    if(i === 6) return mix(C.staging, C.fill, f*0.4);
    if(i >= 5) return mix(C.park, C.parkL, n*0.6);
  }
  /* Lyon Square plaza, east landing of Gillett */
  if(side < 0 && i >= 6 && x > 62.5 && x < 67.5 && back < 5) return mix(C.walk, C.concrete, n*0.5);
  return mix(C.paving, C.pavingL, n*0.8 + f*0.2);
}

/* ---------- strata, fixed 12 bands so eras can morph ---------- */
const BAND_KEYS = ['L-cap','L-fill','L-alluvium','L-lime','L-lime','L-lime','L-shale','L-gypsum','L-shale','L-mine','L-gypsum','L-shale'];
function strata(x, z, e, sed){
  const c = cz(x), d = Math.abs(z - c), hw = halfW(x, e.w), rock = rockTop(x, d);
  const top = groundFt(x, z, e, sed), inCh = d < hw;
  let capBot, fillBot;
  if(!sed){ capBot = fillBot = top; }
  else if(inCh){
    const th = e.bed === 'natural' ? 3.0 : e.bed === 'restored' ? 2.4 : 1.2;
    capBot = fillBot = Math.max(rock, top - th);
  } else if(e.bank === 'urban'){
    capBot  = Math.max(rock + 0.4, top - 4);
    fillBot = Math.max(rock + 0.2, Math.min(capBot, top - 15*(1 - sm((d - hw - 5)/9))));
  } else { capBot = fillBot = Math.max(rock, top - 1.2); }
  capBot = Math.min(capBot, top); fillBot = Math.min(fillBot, capBot);
  const r = Math.min(rock, fillBot), l1 = r - 9, l2 = r - 18, l3 = r - 26;
  return [[top,capBot],[capBot,fillBot],[fillBot,r],[r,l1],[l1,l2],[l2,l3],
          [l3,-54],[-54,-58],[-58,-60],[-60,-64.5],[-64.5,-66],[-66,BOTTOM]];
}
function bandColor(k, x, z, e, i, inCh, col){
  const n = hn(Math.round(x*3.1), Math.round(z*3.1));
  switch(k){
    case 0:
      if(inCh) return e.bed === 'natural' ? mix(C.gravel, C.gravelL, n*0.5) : e.bed === 'restored' ? mix(C.cobble, C.cobbleL, n*0.5) : (i === 4 ? C.sludge : C.silt);
      return e.bank === 'urban' ? mix(C.paving, C.fill, 0.55 + n*0.2) : C.soil;
    case 1: return mix(C.fill, C.fillL, n*0.6);
    case 2: return mix(C.alluvium, C.sand, n*0.4);
    case 3: return mix(C.lime, C.limeL, n*0.25);
    case 4: return mix(C.limeD, C.lime, n*0.3);
    case 5: return mix(C.lime, C.limeD, 0.35 + n*0.2);
    case 7: case 10: return C.gyp;
    case 9: return (Math.floor(col / 2) % 3 === 0) ? C.gyp : C.mineVoid;
    default: return mix(C.shale, C.shaleD, n*0.5);
  }
}

/* ---------- cross-section, drawn as SVG ---------- */
const ANCHORS = [[0,'Ann Street'],[6,'the railroad bridge'],[12,'Leonard Street'],[26,'Sixth Street Bridge'],
  [28,'Sixth Street Dam'],[34,'I-196'],[44,'Bridge Street'],[47,'dam 4'],[53,'dam 3'],[61,'dam 2'],[65,'Gillett Bridge'],
  [72,'dam 1'],[76,'Pearl Street'],[84,'Blue Bridge'],[94,'Fulton Street'],[108,'the amphitheater'],[116,'Wealthy Street']];
function nearest(x){
  let best = null;
  for(const a of ANCHORS){ const dd = Math.abs(a[0] - x); if(!best || dd < best[0]) best = [dd, a[1]]; }
  if(best[0] < 2.2) return `at ${best[1]}`;
  const up = [...ANCHORS].reverse().find(a => a[0] <= x), dn = ANCHORS.find(a => a[0] >= x);
  return up && dn ? `between ${up[1]} and ${dn[1]}` : up ? `below ${up[1]}` : `above ${dn[1]}`;
}

function sectionSVG(sx, i, S){
  const e = ERAS[i], sed = S.sediment, c = cz(sx), hw = halfW(sx, e.w);
  const N = 96, zs = [];
  for(let j = 0; j <= N; j++) zs.push(-SZ + 2*SZ*j/N);
  const gRef = Math.max(bankTop(sx, e.bank, -1), bankTop(sx, e.bank, 1));
  const topFt = gRef + 5;
  const px = z => 10 + (z + SZ)/(2*SZ)*246;
  const py = ft => ft >= -12 ? 12 + (topFt - ft)/(topFt + 12)*148 : 160 + (-12 - ft)/(-12 - BOTTOM)*78;
  const rgb = a => `rgb(${Math.round(a[0]*255)},${Math.round(a[1]*255)},${Math.round(a[2]*255)})`;
  const cols = zs.map(z => strata(sx, z, e, sed));
  let s = '';
  for(let k = 11; k >= 0; k--){
    let top = '', bot = '';
    for(let j = 0; j <= N; j++) top += `${px(zs[j]).toFixed(1)},${py(cols[j][k][0]).toFixed(1)} `;
    for(let j = N; j >= 0; j--) bot += `${px(zs[j]).toFixed(1)},${py(cols[j][k][1]).toFixed(1)} `;
    const mid = Math.floor(N/2), inC = Math.abs(zs[mid] - c) < hw;
    const col = k === 9 ? C.gyp : bandColor(k, sx, zs[mid], e, i, false, 0);
    s += `<polygon points="${top}${bot}" fill="${rgb(col)}" data-k="${BAND_KEYS[k]}"/>`;
  }
  /* mine tunnels */
  const my0 = py(-60), my1 = py(-64.5);
  for(let q = 18; q < 250; q += 27) s += `<rect x="${q}" y="${my0.toFixed(1)}" width="17" height="${(my1 - my0).toFixed(1)}" fill="#121615" data-k="L-mine"/>`;
  /* bed layer highlight inside the channel */
  const inside = zs.map((z,j) => [z,j]).filter(([z]) => Math.abs(z - c) < hw);
  if(sed && inside.length){
    let top = '', bot = '';
    inside.forEach(([z,j]) => top += `${px(z).toFixed(1)},${py(cols[j][0][0]).toFixed(1)} `);
    [...inside].reverse().forEach(([z,j]) => bot += `${px(z).toFixed(1)},${py(cols[j][0][1]).toFixed(1)} `);
    const bc = e.bed === 'natural' ? C.gravel : e.bed === 'restored' ? C.cobble : (i === 4 ? C.sludge : C.silt);
    s += `<polygon points="${top}${bot}" fill="${rgb(bc)}" data-k="L-bed"/>`;
  }
  /* water */
  const wsv = wsFt(sx, e, S), ext = waterExt(sx, e);
  let wet = zs.map((z,j) => [z,j]).filter(([z,j]) => Math.abs(z - c) < hw + ext && wsv > cols[j][0][0]);
  if(S.water && sed && wet.length){
    let pts = `${px(wet[0][0]).toFixed(1)},${py(wsv).toFixed(1)} ${px(wet[wet.length-1][0]).toFixed(1)},${py(wsv).toFixed(1)} `;
    [...wet].reverse().forEach(([z,j]) => pts += `${px(z).toFixed(1)},${py(cols[j][0][0]).toFixed(1)} `);
    const wc = hex(e.water);
    s += `<polygon points="${pts}" fill="${rgb(wc)}" fill-opacity=".82" data-k="water"/>`;
    s += `<line x1="${px(wet[0][0]).toFixed(1)}" x2="${px(wet[wet.length-1][0]).toFixed(1)}" y1="${py(wsv).toFixed(1)}" y2="${py(wsv).toFixed(1)}" stroke="#bfeee6" stroke-width="1"/>`;
  }
  /* floodwalls, dams, bridges at this station */
  if(hasWalls(sx, e) && i >= 3 && S.structures){
    for(const sd of [-1,1]){
      const zi = c + sd*(hw + 0.05), zo = c + sd*(hw + 0.55);
      const x0 = Math.min(px(zi), px(zo)), w = Math.abs(px(zo) - px(zi)) + 1.5;
      s += `<rect x="${x0.toFixed(1)}" y="${py(bankTop(sx, e.bank, sd) + 3.2).toFixed(1)}" width="${w.toFixed(1)}" height="${(py(bedE(sx) - 1) - py(bankTop(sx, e.bank, sd) + 3.2)).toFixed(1)}" fill="#B6B0A2" data-k="walls"/>`;
    }
  }
  let station = '';
  if(S.structures){
    for(const [id, dx] of DAMS){
      if(i >= 3 && i <= 6 && Math.abs(sx - dx) < 0.8){
        const crest = pl(WS.eng, dx - 0.45) + 0.05;
        s += `<rect x="${px(c - hw).toFixed(1)}" y="${py(crest).toFixed(1)}" width="${(px(c + hw) - px(c - hw)).toFixed(1)}" height="${(py(bedE(dx) - 0.8) - py(crest)).toFixed(1)}" fill="${i === 6 ? '#F3722C' : '#C9C3B4'}" fill-opacity=".9" data-k="${id}"/>`;
        station = INFO[id].t;
      }
    }
    if(i >= 1 && Math.abs(sx - 28) < 0.8){
      const base = rockTop(28, 0) - 1;
      s += `<rect x="${px(c - hw - 0.6).toFixed(1)}" y="${py(22.15).toFixed(1)}" width="${(px(c + hw + 0.6) - px(c - hw - 0.6)).toFixed(1)}" height="${(py(base) - py(22.15)).toFixed(1)}" fill="${i <= 2 ? '#6B4E31' : '#C9C3B4'}" data-k="sixth"/>`;
      station = 'Sixth Street Dam';
    }
  }
  /* labels, right column */
  const lab = [];
  const mid = cols[Math.floor(N/2)];
  lab.push(['Ground', gRef, 'L-cap']);
  if(S.water && sed && wet.length){
    const deep = Math.max(0, wsv - bedOf(sx, e.bed));
    lab.push([`Water, about ${Math.max(1, Math.round(deep))} ft`, (wsv + bedOf(sx, e.bed))/2, 'water']);
  }
  if(sed) lab.push(['Riverbed', bedOf(sx, e.bed) - 0.6, 'L-bed']);
  if(sed && e.bank === 'urban') lab.push(['Riverfront fill', gRef - 8, 'L-fill']);
  else if(sed) lab.push(['River deposits', (gRef + rockTop(sx, 14))/2, 'L-alluvium']);
  const rt = rockTop(sx, 0);
  lab.push([`Limestone, ${Math.max(0, Math.round(gRef - rt))} ft down`, rt - 10, 'L-lime']);
  lab.push(['Shale and gypsum', -46, 'L-shale']);
  lab.push([`Gypsum mines, ${Math.round(gRef + 62)} ft down`, -62.2, 'L-mine']);
  let last = -99;
  for(const [t, ft, k] of lab){
    let y = py(ft); if(y < last + 14) y = last + 14; last = y;
    s += `<g data-k="${k}" class="tw-sl"><line x1="260" x2="266" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#7C918D"/>`
       + `<text x="269" y="${(y + 3.5).toFixed(1)}">${t}</text></g>`;
  }
  s += `<path d="M5 ${py(-12).toFixed(1)} l4 -3 l4 6 l4 -3" stroke="#7C918D" fill="none"/>`;
  s += `<text class="tw-sa" x="12" y="249">East bank</text><text class="tw-sa" x="256" y="249" text-anchor="end">West bank</text>`;
  return {svg: s, station};
}

/* ============================================================================
   SCENE
   ========================================================================= */
let R = null;
const S = {water:true, sediment:true, structures:true, labels:true, flood:false, floodK:0, base:'none'};
let ERA = 6, SEL = null, RM = false;
const F = [];
const MORPH = {on:false, t0:0, dur:1};
const ZW = Z1*ZS;            /* half width of the ribbon in model units */

function M(color, o){ return new THREE.MeshStandardMaterial(Object.assign({color, roughness:.86, metalness:0, flatShading:true}, o || {})); }
function box(w, h, d, mat, x, y, z){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
/* put a group at a station, its x axis pointing downstream */
function frameAt(g, x, zR, yFt){
  const p = Wr(x, zR, yFt), c = curveAt(xr(x));
  g.position.set(p[0], p[1], p[2]); g.rotation.y = Math.atan2(-c.tz, c.tx); return g;
}
/* put a group at a real coordinate, aligned with the street grid */
function gridAt(g, lat, lng, yFt){ const p = toXZ(lat, lng); g.position.set(p[0], Y(yFt || 0), p[1]); g.rotation.y = 0; return g; }
const hwR = (x, w) => halfW(x, w)*ZS;
const gFt = (x, zR, e, sed) => groundFt(x, zR/ZS, e, sed);

function feat(key, range, group, obj, o = {}){
  const f = Object.assign({key, range, group, obj, grow:'all', label:null, lcls:'', lpri:2, anchor:null, apply:null, cond:null, deep:false, pulse:false, noPick:false, mats:[]}, o);
  obj.traverse(m => { if(m.isMesh){ m.castShadow = group === 'built' || group === 'rock' || group === 'logs'; m.receiveShadow = true; } });
  f.k = 0; f.from = 0; f.to = 0;
  obj.visible = false;
  obj.userData.s0 = obj.scale.clone();
  const seen = new Set();
  obj.traverse(m => {
    if(!m.isMesh) return;
    m.userData.f = f;
    if(!f.noPick){ R.pick.push(m); R.pickF.push(m); }
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => {
      if(mm && mm.emissive && !seen.has(mm)){ seen.add(mm); f.mats.push(mm); }
    });
  });
  R.scene.add(obj); F.push(f);
  return f;
}
function wantOn(f, i){
  if(i < f.range[0] || i > f.range[1]) return false;
  if(f.group === 'built' && !S.structures) return false;
  if(f.group === 'built' && !S.sediment && !f.deep) return false;
  if((f.group === 'rock' || f.group === 'life' || f.group === 'markers' || f.group === 'ground') && !S.sediment) return false;
  if(f.group === 'ground' && imageryOn()) return false;
  if(f.group === 'logs' && !S.water) return false;
  if(f.cond && !f.cond(i)) return false;
  return true;
}
function imageryOn(){ return S.base !== 'none' && ERA >= 5 && S.sediment && !!(R && R.base && R.base.tex && R.base.kind === S.base); }

/* ---------- ground surface, a ribbon following the river ---------- */
function buildTerrain(){
  const nu = NX + 1, nv = NZ + 1, n = nu*nv;
  const pos = new Float32Array(n*3), col = new Float32Array(n*3), uv = new Float32Array(n*2), bx = new Float32Array(n), bz = new Float32Array(n);
  const idx = [];
  for(let a = 0; a < nu; a++){
    const x = X0 + (X1 - X0)*a/NX;
    for(let b = 0; b < nv; b++){
      const k = a*nv + b, z = Z0 + (Z1 - Z0)*b/NZ, p = W(x, z, 0);
      pos[k*3] = p[0]; pos[k*3 + 2] = p[2]; bx[k] = x; bz[k] = z;
      if(a < NX && b < NZ){ const q = (a + 1)*nv + b; idx.push(k, k + 1, q, q, k + 1, q + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:.95, metalness:0});
  const mesh = new THREE.Mesh(g, mat);
  mesh.userData.terrain = true; mesh.frustumCulled = false; mesh.receiveShadow = true;
  R.scene.add(mesh); R.pick.push(mesh);
  R.ter = {mesh, g, n, bx, bz, y0:new Float32Array(n), y1:new Float32Array(n), c0:new Float32Array(n*3), c1:new Float32Array(n*3)};
}
function terrainTarget(i){
  const T = R.ter, e = ERAS[i], img = imageryOn();
  for(let k = 0; k < T.n; k++){
    const x = T.bx[k], z = T.bz[k];
    T.y1[k] = Y(groundFt(x, z, e, S.sediment));
    let c;
    if(img){ const d = Math.abs(z) < halfW(x, e.w) ? 0.78 : 1.0; c = [d, d, d]; }
    else c = groundColor(x, z, e, i, S.sediment);
    T.c1[k*3] = c[0]; T.c1[k*3 + 1] = c[1]; T.c1[k*3 + 2] = c[2];
  }
  const want = img ? R.base.tex : null;
  if(T.mesh.material.map !== want){ T.mesh.material.map = want; T.mesh.material.needsUpdate = true; }
}

/* ---------- the sides of the block, where the strata show ---------- */
function buildSkirts(){
  const alongX = (z, a, b, n) => Array.from({length:n + 1}, (_, j) => [a + (b - a)*j/n, z]);
  const alongZ = (x, a, b, n) => Array.from({length:n + 1}, (_, j) => [x, a + (b - a)*j/n]);
  const edges = [alongX(Z1, X0, X1, NX), alongX(Z0, X1, X0, NX), alongZ(X1, Z1, Z0, NZ), alongZ(X0, Z0, Z1, NZ)];
  const quads = [];
  edges.forEach((p, ei) => { for(let j = 0; j < p.length - 1; j++) for(let k = 0; k < 12; k++) quads.push(ei, j, k); });
  const nq = quads.length/3, nv = nq*6;
  const pos = new Float32Array(nv*3);
  const wp = edges.map(p => p.map(([x, z]) => W(x, z, 0)));
  for(let q = 0; q < nq; q++){
    const ei = quads[q*3], j = quads[q*3 + 1], A = wp[ei][j], B = wp[ei][j + 1];
    const pts = [A, B, B, A, B, A];
    for(let v = 0; v < 6; v++){ const o = (q*6 + v)*3; pos[o] = pts[v][0]; pos[o + 2] = pts[v][2]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv*3), 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide}));
  mesh.userData.skirt = true; mesh.frustumCulled = false;
  R.scene.add(mesh); R.pick.push(mesh);
  R.sk = {mesh, g, edges, quads, nq, nv, y0:new Float32Array(nv), y1:new Float32Array(nv), c0:new Float32Array(nv*3), c1:new Float32Array(nv*3)};
}
function skirtTarget(i){
  const K = R.sk, e = ERAS[i];
  const st = K.edges.map(p => p.map(([x, z]) => strata(x, z, e, S.sediment)));
  for(let q = 0; q < K.nq; q++){
    const ei = K.quads[q*3], j = K.quads[q*3 + 1], k = K.quads[q*3 + 2];
    const a = st[ei][j][k], b = st[ei][j + 1][k];
    const ys = [a[0], b[0], b[1], a[0], b[1], a[1]];
    const P = K.edges[ei][j], Q = K.edges[ei][j + 1], mx = (P[0] + Q[0])/2, mz = (P[1] + Q[1])/2;
    const shade = [0.94, 0.62, 0.8, 0.66][ei];
    const col = bandColor(k, mx, mz, e, i, Math.abs(mz - cz(mx)) < halfW(mx, e.w), j).map(v => v*shade);
    for(let v = 0; v < 6; v++){
      const o = q*6 + v;
      K.y1[o] = Y(ys[v]);
      K.c1[o*3] = col[0]; K.c1[o*3 + 1] = col[1]; K.c1[o*3 + 2] = col[2];
    }
  }
}

/* ---------- water surface, end caps, and the moving flow ---------- */
function buildWater(){
  const nu = WX + 1, nv = WZ + 1, n = nu*nv, idx = [];
  for(let a = 0; a < WX; a++) for(let b = 0; b < WZ; b++){
    const p = a*nv + b, q = (a + 1)*nv + b;
    idx.push(p, p + 1, q, q, p + 1, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  g.setIndex(idx);
  const mat = new THREE.MeshPhongMaterial({color:0x3F948A, transparent:true, opacity:.7, shininess:70, specular:0x8FD3CA, flatShading:true, side:THREE.DoubleSide, depthWrite:false});
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2; mesh.userData.water = true; mesh.frustumCulled = false; mesh.receiveShadow = true;
  R.scene.add(mesh); R.pick.push(mesh);
  R.wat = {mesh, g, n, nu, nv, p0:new Float32Array(n*3), p1:new Float32Array(n*3), cur:new Float32Array(n*3), slope:new Float32Array(nu)};
}
function waterTarget(i){
  const e = ERAS[i], Wt = R.wat, sf = {floodK:S.floodK};
  for(let a = 0; a < Wt.nu; a++){
    const x = X0 + (X1 - X0)*a/WX, hw = halfW(x, e.w) + waterExt(x, e);
    const yf = wsFt(x, e, sf);
    Wt.slope[a] = Math.abs(wsFt(x + 0.25, e, sf) - wsFt(x - 0.25, e, sf))/0.5;
    for(let b = 0; b < Wt.nv; b++){
      const k = (a*Wt.nv + b)*3, p = W(x, (b/WZ*2 - 1)*hw, yf);
      Wt.p1[k] = p[0]; Wt.p1[k + 1] = p[1]; Wt.p1[k + 2] = p[2];
    }
  }
}
function buildCaps(){
  const nv = WZ*2*6, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv*3), 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0x3F948A, transparent:true, opacity:.5, side:THREE.DoubleSide, depthWrite:false}));
  mesh.renderOrder = 1; mesh.frustumCulled = false;
  R.scene.add(mesh);
  R.cap = {mesh, g, nv, p0:new Float32Array(nv*3), p1:new Float32Array(nv*3)};
}
function capTarget(i){
  const e = ERAS[i], P = R.cap.p1, sf = {floodK:S.floodK};
  let o = 0;
  for(const xe of [X1 - 0.03, X0 + 0.03]){
    const hw = halfW(xe, e.w) + waterExt(xe, e), top = wsFt(xe, e, sf);
    for(let b = 0; b < WZ; b++){
      const za = -hw + 2*hw*b/WZ, zb = -hw + 2*hw*(b + 1)/WZ;
      const ga = Math.min(top, groundFt(xe, za, e, S.sediment)), gb = Math.min(top, groundFt(xe, zb, e, S.sediment));
      for(const [z, y] of [[za, top],[zb, top],[zb, gb],[za, top],[zb, gb],[za, ga]]){ const p = W(xe, z, y); P[o++] = p[0]; P[o++] = p[1]; P[o++] = p[2]; }
    }
  }
}
function spriteTex(){
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function buildParticles(){
  const N = 1800, g = new THREE.BufferGeometry();
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({size:.13, map:spriteTex(), vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, sizeAttenuation:true});
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 3;
  R.scene.add(pts);
  const u = new Float32Array(N), v = new Float32Array(N);
  for(let k = 0; k < N; k++){ u[k] = Math.random(); v[k] = 0.06 + Math.random()*0.88; }
  R.par = {pts, g, N, u, v, pos, col, tint:[.55,.78,.76], flowK:1};
}
function stepParticles(dt){
  const P = R.par, Wt = R.wat, op = Wt.mesh.material.opacity;
  P.pts.visible = Wt.mesh.visible && op > 0.05;
  if(!P.pts.visible) return;
  const br = clamp(op*1.35, 0, 1), cur = Wt.cur, nv = Wt.nv;
  for(let k = 0; k < P.N; k++){
    let u = P.u[k];
    const a0 = Math.min(WX - 1, Math.floor(u*WX));
    u += P.flowK*(0.0035 + 0.005*Math.min(Wt.slope[a0]/0.6, 1))*dt*6;
    if(u >= 1){ u -= 1; P.v[k] = 0.06 + Math.random()*0.88; }
    P.u[k] = u;
    const fu = u*WX, a = Math.min(WX - 1, Math.floor(fu)), tu = fu - a;
    const fv = P.v[k]*WZ, b = Math.min(WZ - 1, Math.floor(fv)), tv = fv - b;
    const i00 = (a*nv + b)*3, i10 = ((a + 1)*nv + b)*3, i01 = i00 + 3, i11 = i10 + 3;
    for(let d = 0; d < 3; d++){
      const top = cur[i00 + d] + (cur[i10 + d] - cur[i00 + d])*tu, bot = cur[i01 + d] + (cur[i11 + d] - cur[i01 + d])*tu;
      P.pos[k*3 + d] = top + (bot - top)*tv;
    }
    P.pos[k*3 + 1] += 0.012;
    const w = clamp(0.06 + Wt.slope[a]*2.2, 0.05, 1), s = Math.min(1, w*1.15)*br;
    P.col[k*3] = lerp(P.tint[0], 1, w)*s; P.col[k*3 + 1] = lerp(P.tint[1], 1, w)*s; P.col[k*3 + 2] = lerp(P.tint[2], 1, w)*s;
  }
  P.g.attributes.position.needsUpdate = true; P.g.attributes.color.needsUpdate = true;
}
function rippleWater(t){
  const Wt = R.wat; if(!Wt.mesh.visible) return;
  const pos = Wt.g.attributes.position.array, cur = Wt.cur, fk = Math.pow(R.par.flowK, 0.3);
  for(let a = 0; a < Wt.nu; a++){
    const amp = (0.0015 + Math.min(Wt.slope[a], 1.2)*0.009)*fk;
    for(let b = 0; b < Wt.nv; b++){
      const o = (a*Wt.nv + b)*3, x = cur[o], z = cur[o + 2];
      pos[o] = x; pos[o + 2] = z;
      pos[o + 1] = cur[o + 1] + amp*Math.sin(x*3.1 - t*2.2 + b*0.9)*Math.cos(z*2.3 + t*1.6);
    }
  }
  Wt.g.attributes.position.needsUpdate = true;
}

/* ---------- map tiles draped over the ground ---------- */
const BASEMAPS = {
  sat:{name:'Satellite', zoom:16, attr:'Imagery: USGS The National Map', url:(z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`,
       alt:{attr:'Imagery: Esri, Maxar, Earthstar Geographics and the GIS User Community', url:(z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`}},
  map:{name:'Map', zoom:16, attr:'Map: OpenStreetMap contributors, CARTO', url:(z, x, y) => `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/${z}/${x}/${y}.png`,
       alt:{attr:'Map: OpenStreetMap contributors', url:(z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`}}
};
function tileRange(zoom){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for(let a = 0; a <= 40; a++){
    const x = X0 + (X1 - X0)*a/40;
    for(const z of [Z0, 0, Z1]){ const p = W(x, z, 0), m = mercPx(p[0], p[2], zoom); x0 = Math.min(x0, m[0]); x1 = Math.max(x1, m[0]); y0 = Math.min(y0, m[1]); y1 = Math.max(y1, m[1]); }
  }
  return {tx0:Math.floor(x0/256), tx1:Math.floor(x1/256), ty0:Math.floor(y0/256), ty1:Math.floor(y1/256)};
}
function loadTile(url){
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile')); im.src = url; });
}
async function fetchBase(kind){
  const B = BASEMAPS[kind]; if(!B) throw new Error('no basemap');
  const zoom = B.zoom, tr = tileRange(zoom), cols = tr.tx1 - tr.tx0 + 1, rows = tr.ty1 - tr.ty0 + 1;
  const canvas = document.createElement('canvas'); canvas.width = cols*256; canvas.height = rows*256;
  const ctx = canvas.getContext('2d');
  const tryProvider = async prov => {
    const jobs = [];
    for(let ty = tr.ty0; ty <= tr.ty1; ty++) for(let tx = tr.tx0; tx <= tr.tx1; tx++) jobs.push(loadTile(prov.url(zoom, tx, ty)).then(im => ctx.drawImage(im, (tx - tr.tx0)*256, (ty - tr.ty0)*256)));
    await Promise.all(jobs);
  };
  let attr = B.attr;
  try{ await tryProvider(B); }
  catch(e){ ctx.clearRect(0, 0, canvas.width, canvas.height); await tryProvider(B.alt); attr = B.alt.attr; }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy()); tex.minFilter = THREE.LinearMipmapLinearFilter;
  const T = R.ter, uv = T.g.attributes.uv.array, pos = T.g.attributes.position.array;
  for(let k = 0; k < T.n; k++){
    const m = mercPx(pos[k*3], pos[k*3 + 2], zoom);
    uv[k*2] = (m[0] - tr.tx0*256)/canvas.width; uv[k*2 + 1] = 1 - (m[1] - tr.ty0*256)/canvas.height;
  }
  T.g.attributes.uv.needsUpdate = true;
  return {kind, tex, attr};
}
let baseLoading = null;
function setBase(kind){
  S.base = kind;
  if(kind === 'none' || !R || !R.gl){ retarget(); hud(); return; }
  if(R.base && R.base.kind === kind){ retarget(); hud(); return; }
  if(baseLoading === kind) return;
  baseLoading = kind;
  fetchBase(kind).then(b => { if(R.base && R.base.tex) R.base.tex.dispose(); R.base = b; baseLoading = null; if(S.base === kind){ retarget(); hud(); } })
    .catch(() => { baseLoading = null; R.baseFail = kind; if(S.base === kind){ retarget(); hud(); } });
}

/* ---------- builders for things in and around the river ---------- */
function pinGroup(color, tallFt){
  const g = new THREE.Group(), m = M(color, {roughness:.5}), h = 0.55;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 6), m); stem.position.y = h/2; g.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), m); head.position.y = h; g.add(head);
  return g;
}
function instanced(list, geo, place){
  const mesh = new THREE.InstancedMesh(geo, M(0xFFFFFF, {roughness:.92}), list.length);
  const d = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((it, k) => { place(it, d, col); d.updateMatrix(); mesh.setMatrixAt(k, d.matrix); mesh.setColorAt(k, col); });
  mesh.instanceMatrix.needsUpdate = true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
/* boulders: [x old, z old, radius units] */
function boulderSet(list, e){
  return instanced(list, new THREE.IcosahedronGeometry(1, 0), ([x, z, r], d, col) => {
    const p = W(x, z, groundFt(x, z, e, true)); d.position.set(p[0], p[1] + r*0.3, p[2]);
    d.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    d.scale.set(r, r*0.78, r*0.92);
    const v = 0.42 + Math.random()*0.16; col.setRGB(v, v*0.97, v*0.9);
  });
}
function musselSet(e, n, x0, x1, spread){
  const list = [];
  for(let k = 0; k < n; k++){ const x = x0 + Math.random()*(x1 - x0); list.push([x, (Math.random()*2 - 1)*halfW(x, e.w)*spread]); }
  return instanced(list, new THREE.SphereGeometry(0.03, 6, 4), ([x, z], d, col) => {
    const p = W(x, z, groundFt(x, z, e, true)); d.position.set(p[0], p[1] + 0.006, p[2]);
    d.rotation.set(0, Math.random()*Math.PI, 0);
    d.scale.set(1.4, 0.45, 0.9);
    col.setHSL(0.12 + Math.random()*0.05, 0.28, 0.17 + Math.random()*0.1);
  });
}
/* strip geometry along the river: fn(x) returns {zi, zo, yb, yt, yg} in real units and feet */
function stripMesh(x0, x1, N, fn, mat){
  const P = [];
  const quad = (a, b, c, d) => P.push(...a, ...b, ...c, ...a, ...c, ...d);
  for(let j = 0; j < N; j++){
    const xa = x0 + (x1 - x0)*j/N, xb = x0 + (x1 - x0)*(j + 1)/N, A = fn(xa), B = fn(xb);
    const p = (x, z, ft) => Wr(x, z, ft);
    quad(p(xa, A.zi, A.yb), p(xb, B.zi, B.yb), p(xb, B.zi, B.yt), p(xa, A.zi, A.yt));
    quad(p(xa, A.zi, A.yt), p(xb, B.zi, B.yt), p(xb, B.zo, B.yt), p(xa, A.zo, A.yt));
    quad(p(xa, A.zo, A.yt), p(xb, B.zo, B.yt), p(xb, B.zo, B.yg), p(xa, A.zo, A.yg));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function wallMesh(side){
  return stripMesh(16, X1, 200, x => {
    const hw = hwR(x, 'eng'), bt = bankTop(x, 'urban', side);
    return {zi:side*(hw + 0.01), zo:side*(hw + 0.04), yb:bedE(x) - 1, yt:bt + 3.2, yg:bt - 0.5};
  }, M(0xA39D90, {side:THREE.DoubleSide}));
}
/* flat ground patch along the river between two across offsets, in real units */
function patch(x0, x1, za, zb, ft, mat, N){
  const P = [], n = N || 12;
  for(let j = 0; j < n; j++){
    const xa = x0 + (x1 - x0)*j/n, xb = x0 + (x1 - x0)*(j + 1)/n;
    const a = Wr(xa, za, ft(xa)), b = Wr(xb, za, ft(xb)), c = Wr(xb, zb, ft(xb)), d = Wr(xa, zb, ft(xa));
    P.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function bridge(x, style){
  const hw = hwR(x, 'eng');
  const dyFt = Math.max(bankTop(x, 'urban', -1), bankTop(x, 'urban', 1)) + 1.5, dy = Y(dyFt);
  const span = hw*2.12 + 0.6, wid = {road:0.55, iron:0.24, blue:0.18, arch:0.28, freeway:1.1, rail:0.2, wood:0.2}[style] || 0.5;
  const g = new THREE.Group();
  const deck = M(style === 'road' || style === 'freeway' ? 0x9E9A8E : 0xA39F92), pier = M(0x938F83);
  g.add(box(wid, 0.025, span, deck, 0, dy, 0));
  const rail = M(0x8E8A80); for(const s of [-1, 1]) g.add(box(0.012, 0.03, span*0.98, rail, s*(wid/2 - 0.006), dy + 0.027, 0));
  const rt = Y(bedE(x) - 1.5);
  const piers = style === 'arch' ? [-0.5, 0.5] : style === 'freeway' ? [-0.6, -0.2, 0.2, 0.6] : [-0.55, 0, 0.55];
  for(const t of piers){ const h = dy - rt - 0.012; g.add(box(wid*0.72, h, 0.07, pier, 0, rt + h/2, t*hw)); }
  let truss = null, top = dy + 0.1;
  if(style === 'blue' || style === 'iron'){
    truss = M(style === 'blue' ? 0x3B6FB6 : 0x5E5A55, {roughness:.6, metalness:.2});
    const H = (style === 'blue' ? 22 : 20)*VB, L = span*0.94, nb = 12, seg = L/nb;
    for(const sx of [-wid/2, wid/2]){
      g.add(box(0.014, 0.02, L, truss, sx, dy + H, 0));
      g.add(box(0.014, 0.02, L, truss, sx, dy + 0.03, 0));
      for(let b = 0; b <= nb; b++){
        const z = -L/2 + b*seg;
        g.add(box(0.012, H - 0.03, 0.012, truss, sx, dy + 0.03 + (H - 0.03)/2, z));
        if(b < nb){
          const len = Math.hypot(seg, H - 0.03), ang = Math.atan2(H - 0.03, seg);
          const d = box(0.01, 0.01, len, truss, sx, dy + 0.03 + (H - 0.03)/2, z + seg/2);
          d.rotation.x = (b < nb/2 ? -1 : 1)*ang; g.add(d);
        }
      }
    }
    for(let b = 0; b <= nb; b += 2) g.add(box(wid, 0.01, 0.01, truss, 0, dy + H, -L/2 + b*seg));
    top = dy + H;
  }
  if(style === 'arch'){
    const am = M(0xBDB6A6);
    for(const [a, b] of [[-hw*1.06, -0.5*hw], [-0.5*hw, 0.5*hw], [0.5*hw, hw*1.06]]){
      const r = (b - a)/2, zc = (a + b)/2;
      for(const sx of [-wid*0.38, wid*0.38]){
        const tor = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 20, Math.PI), am);
        tor.rotation.y = Math.PI/2; tor.scale.set(1, 0.3, 1);
        tor.position.set(sx, dy - 0.03 - r*0.3, zc); g.add(tor);
      }
    }
  }
  if(style === 'wood' || style === 'rail'){
    const wm = M(0x5A4632); g.children[0].material = wm;
    for(let b = -2; b <= 2; b++) g.add(box(wid*1.1, 0.02, 0.03, wm, 0, dy + 0.02, b*span/5));
  }
  g.rotation.y = Math.PI/2;                    /* streets run east to west */
  return {g, top, truss, dyFt};
}
function excavator(side){
  const g = new THREE.Group();
  const o = M(0xF3722C, {roughness:.6}), dk = M(0x2B2F30), gl = M(0x9FB7B9, {roughness:.3});
  g.add(box(0.3, 0.07, 0.22, dk, 0, 0.035, 0));
  g.add(box(0.26, 0.12, 0.2, o, 0, 0.13, 0));
  g.add(box(0.1, 0.1, 0.1, gl, 0.06, 0.24, 0.04));
  const boom = box(0.04, 0.04, 0.36, o, -0.02, 0.26, -side*0.2); boom.rotation.x = side*0.55; g.add(boom);
  const stick = box(0.03, 0.03, 0.24, o, -0.02, 0.18, -side*0.4); stick.rotation.x = -side*0.6; g.add(stick);
  return g;
}
function gaugeTex(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const x = c.getContext('2d'), Y = g => 512 - g/26*512;
  x.fillStyle = '#E9E3D5'; x.fillRect(0, 0, 64, 512);
  for(const [a, b, col] of [[12,18,'#D3A253'],[18,21,'#F3722C'],[21,23,'#E5544B'],[23,26,'#9E2B25']]){ x.fillStyle = col; x.fillRect(0, Y(b), 64, Y(a) - Y(b)); }
  x.fillStyle = '#1B1F1E';
  for(let g = 0; g <= 26; g++) x.fillRect(0, Y(g) - 1, g % 5 === 0 ? 30 : 14, 2);
  x.font = 'bold 18px sans-serif';
  for(let g = 5; g <= 25; g += 5) x.fillText(String(g), 33, Y(g) + 6);
  x.fillStyle = '#08201F'; x.fillRect(0, Y(21.85) - 2, 64, 4);
  x.font = 'bold 12px sans-serif'; x.fillText('2013', 28, Y(21.85) - 6);
  return new THREE.CanvasTexture(c);
}
function building(w, d, hM, color){
  const g = new THREE.Group(), wu = w/MPU, du = d/MPU, hu = hM*3.281*VB;
  const m = M(color), dark = M(new THREE.Color(color).multiplyScalar(0.82).getHex());
  g.add(box(wu, hu, du, m, 0, hu/2, 0));
  g.add(box(wu*0.96, 0.02, du*0.96, dark, 0, hu + 0.01, 0));
  return g;
}

function buildFeatures(){
  const E = ERAS;
  /* Sixth Street Dam: timber, then concrete */
  for(const [range, color, w] of [[[1,2], 0x6B4E31, 'natural'], [[3,8], 0xC9C3B4, 'eng']]){
    const x = 28, hw = hwR(x, w) + 0.12, base = rockTop(x, 0) - 1, crest = 22.15, h = Y(crest) - Y(base);
    const g = new THREE.Group(); frameAt(g, x, 0, base);
    const m = M(color);
    g.add(box(0.28, h, hw*2, m, 0, h/2, 0));
    const tail = Math.max(0.01, Y(bedOf(29.6, w) + 0.8) - Y(base));
    g.add(box(0.45, tail, hw*2, m, 0.36, tail/2, 0));
    feat('sixth', range, 'built', g, {grow:'y', deep:true, label:'Sixth Street Dam', lpri:1, anchor:[x, -hw*0.3, crest + 4]});
  }
  /* the four low-head dams */
  for(const [id, x] of DAMS){
    const hw = hwR(x, 'eng') + 0.08, crest = pl(WS.eng, x - 0.45) + 0.05, base = bedE(x) - 0.8, h = Y(crest) - Y(base);
    const g = new THREE.Group(); frameAt(g, x, 0, base);
    g.add(box(0.15, h, hw*2, M(0xC9C3B4), 0, h/2, 0));
    feat(id, [3,6], 'built', g, {grow:'y', deep:true, pulse:true, label:'Dam ' + id[1], lpri:1, anchor:[x, hw*0.45, crest + 3]});
  }
  /* floodwalls */
  { const g = new THREE.Group(); g.add(wallMesh(-1)); g.add(wallMesh(1));
    feat('walls', [3,8], 'built', g, {grow:'y', deep:true, label:'Floodwall', lpri:2, anchor:[38, hwR(38,'eng') + 0.1, bankTop(38,'urban',1) + 6]}); }
  /* bridges at their real crossings */
  for(const [name, lat, lng, x, style] of XINGS){
    if(style === 'dam') continue;
    const key = {'Ann Street':'bAnn','Railroad bridge':'bRail','Leonard Street':'bLeonard','Sixth Street Bridge':'bSixth','I-196':'bI196','Bridge Street':'bBridge',
                 'Gillett Bridge':'bGillett','Pearl Street':'bPearl','Blue Bridge':'bBlue','Fulton Street':'bFulton','Wealthy Street':'bWealthy'}[name];
    const range = style === 'freeway' ? [5,8] : [3,8];
    const st = style === 'street' ? 'road' : style;
    const {g, top, truss, dyFt} = bridge(x, st);
    const p = toXZ(lat, lng); g.position.set(p[0], 0, p[1]);
    const lpri = (style === 'blue' || style === 'arch' || style === 'iron') ? 1 : 2;
    feat(key, range, 'built', g, {grow:'y', deep:true, label:name === 'Railroad bridge' ? 'Railroad bridge' : name.replace(' Street', ' St'), lpri,
      anchor:[x, -(hwR(x,'eng') + 0.35), dyFt + (top - Y(dyFt))/FT + 5],
      apply: key === 'bBlue' ? (i => truss.color.setHex(i <= 4 ? 0x3A3D40 : 0x3B6FB6)) : null});
  }
  /* 1883: the broken railroad bridges */
  for(const [x, side] of [[6, 1], [84, -1]]){
    const {g, dyFt} = bridge(x, 'wood'); const p = W(x, 0, 0); g.position.set(p[0], 0, p[2]);
    const hw = hwR(x, 'natural'), fall = g.children[0];
    fall.scale.z = 0.5; fall.position.z = side*hw*0.5; fall.rotation.x = side*0.35; fall.position.y -= 0.12;
    feat('rail', [2,2], 'built', g, {grow:'pop', label:'Railroad bridge', lpri:1, anchor:[x, -side*hw*0.5, dyFt + 6]});
  }
  /* 1849 to 1883: the east side mill canal and mills */
  { const g = new THREE.Group();
    g.add(patch(28.6, 60, -(hwR(28.6,'natural') + 1.0), -(hwR(28.6,'natural') + 1.5), x => canalWs(x), new THREE.MeshPhongMaterial({color:0x4F8F7C, shininess:60, flatShading:true, side:THREE.DoubleSide}), 40));
    const wood = M(0x6A4B30), roof = M(0x3B2F27);
    for(const x of [33, 39.5, 46, 52.5, 58]){
      const zR = -(hwR(x, 'natural') + 1.95), y = gFt(x, zR, E[1], true);
      const b = new THREE.Group(); frameAt(b, x, zR, y);
      b.add(box(0.7, 0.34, 0.5, wood, 0, 0.17, 0)); b.add(box(0.76, 0.06, 0.56, roof, 0, 0.37, 0)); g.add(b);
    }
    feat('canal', [1,2], 'built', g, {grow:'pop', label:'Mill canal', lpri:1, anchor:[44, -(hwR(44,'natural') + 1.25), canalWs(44) + 6]}); }
  /* early village on the east bank */
  { const g = new THREE.Group(), wood = M(0x7A5A3A), roof = M(0x4A3A2A);
    for(const [x, dz] of [[64,1.4],[67,2.0],[70,1.5],[73,2.3],[76,1.6],[79,2.1]]){
      const zR = -(hwR(x,'natural') + dz), y = gFt(x, zR, E[1], true), b = new THREE.Group(); frameAt(b, x, zR, y);
      b.add(box(0.36, 0.22, 0.3, wood, 0, 0.11, 0)); b.add(box(0.4, 0.05, 0.34, roof, 0, 0.245, 0)); g.add(b);
    }
    feat('oldtown', [1,2], 'built', g, {grow:'pop', label:'Village', lpri:2, anchor:[70, -(hwR(70,'natural') + 2.6), gFt(70, -(hwR(70,'natural') + 2), E[1], true) + 9]}); }
  /* 1911 to 1969: the early downtown along the east bank, factories on the west */
  { const g = new THREE.Group();
    const blocks = [[46,-1.1,45],[49,-1.9,60],[52,-1.2,35],[55,-2.2,80],[58,-1.4,55],[62,-2.4,70],[66,-1.3,40],[70,-2.1,95],[73,-1.2,60],[77,-2.0,50],[81,-1.4,70],[86,-2.2,110],[90,-1.3,45],[93,-2.3,65],
                    [30,1.6,30],[36,2.1,25],[42,1.5,35],[50,2.4,20],[58,1.7,30],[64,2.3,25],[74,1.9,35],[88,1.8,28],[100,-1.6,40],[106,1.7,30]];
    blocks.forEach(([x, dz, hFt], k) => {
      const zR = (dz > 0 ? 1 : -1)*(hwR(x,'eng') + Math.abs(dz)), y = bankTop(x, 'urban', dz > 0 ? 1 : -1);
      const b = building(28 + (k % 3)*14, 24 + (k % 4)*12, hFt/3.281, [0xB4A78E, 0xA89C86, 0x9C8F7C][k % 3]);
      const p = Wr(x, zR, y); b.position.set(p[0], p[1], p[2]); g.add(b);
    });
    feat('oldtown', [3,4], 'built', g, {grow:'y', label:'Early downtown', lpri:2, anchor:[70, -(hwR(70,'eng') + 2.1), bankTop(70,'urban',-1) + 40]}); }
  /* today's landmarks, at their real coordinates */
  for(const L of LANDMARKS){
    const g = building(L.w, L.d, L.h, L.col), st = geoW(L.lat, L.lng).st, side = st.d < 0 ? -1 : 1;
    gridAt(g, L.lat, L.lng, bankTop(st.x, 'urban', side));
    const big = L.h > 60 || ['devos','ford','grpm','acrisure'].includes(L.k);
    feat(L.k, L.era, 'built', g, {grow:'y', landmark:true, cond:() => !(R.city && R.city.on), label:L.t.replace(', Pantlind wing', '').replace(' tower', ''), lpri:big ? 1 : 2,
      anchor:[st.x, st.d, bankTop(st.x, 'urban', side) + L.h*3.281*VB/VY + 5]});
  }
  /* streets across the ribbon, either side of each bridge */
  { const g = new THREE.Group(), sm = new THREE.MeshBasicMaterial({color:0xE4DFD3});
    for(const [name, lat, lng, x, style] of XINGS){
      if(style === 'dam' || style === 'rail' || style === 'blue' || style === 'arch') continue;
      const p = toXZ(lat, lng), hw = hwR(x, 'eng') + 0.25, wid = style === 'freeway' ? 1.0 : 0.5;
      for(const side of [-1, 1]){
        const len = ZW - hw, y = Y(bankTop(x, 'urban', side)) + 0.004;
        g.add(box(len, 0.004, wid, sm, p[0] + side*(hw + len/2), y, p[1]));
      }
    }
    feat('street', [3,8], 'ground', g, {grow:'pop', noPick:true}); }
  /* parks, when the photo is not underneath */
  { const g = new THREE.Group(), pm = M(0x4E6D44);
    const parks = [[65,76,1,0.05,3.4],[12,27,-1,0.05,2.4],[25,28.5,-1,0.05,1.6],[26.5,31,1,0.05,1.5],[70,72.5,-1,0.05,0.9]];
    for(const [x0, x1, side, a, b] of parks){
      const za = side*(hwR((x0 + x1)/2,'eng') + a), zb = side*(hwR((x0 + x1)/2,'eng') + b);
      g.add(patch(x0, x1, za, zb, x => bankTop(x, 'urban', side) + 0.08, pm, 10));
    }
    feat('park', [5,8], 'ground', g, {grow:'pop', label:'Ah-Nab-Awen Park', lcls:'park', lpri:2, anchor:[70, hwR(70,'eng') + 1.7, bankTop(70,'urban',1) + 3]}); }
  /* 1883: the logs */
  { const list = [];
    for(let k = 0; k < 1500; k++){ const t = Math.pow(Math.random(), 0.6), x = 1 + t*26.5; list.push([x, (Math.random()*2 - 1)*halfW(x, 'natural')*0.92]); }
    const logs = instanced(list, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), ([x, z], d, col) => {
      const pile = x > 22 ? (x - 22)*0.5 : 0, p = W(x, z, pl(WS.dam6, x) + Math.random()*(1.5 + pile) - 0.3);
      d.position.set(p[0], p[1], p[2]);
      const c = curveAt(xr(x));
      d.rotation.set((Math.random() - .5)*0.25, Math.atan2(-c.tz, c.tx) + (Math.random() - .5)*1.1, Math.PI/2 + (Math.random() - .5)*0.2);
      col.setHSL(0.07 + Math.random()*0.03, 0.38, 0.2 + Math.random()*0.13);
    });
    feat('logs', [2,2], 'logs', logs, {grow:'pop', label:'Log jam', lpri:1, anchor:[22, 0, pl(WS.dam6,22) + 8]}); }
  /* fish ladder, west end of the dam */
  { const g = new THREE.Group(), con = M(0xB4AE9F), wat = M(0x5FAFA3, {roughness:.3});
    for(let s = 0; s < 7; s++){
      const x = 28.15 + s*0.24, top = 21.2 - s*1.12, zR = hwR(x, 'eng') - 0.32, base = bedE(x) - 0.5, h = Y(top) - Y(base);
      const b = new THREE.Group(); frameAt(b, x, zR, base);
      b.add(box(0.22, h, 0.42, con, 0, h/2, 0)); b.add(box(0.16, 0.012, 0.3, wat, 0, h + 0.006, 0)); g.add(b);
    }
    feat('ladder', [5,8], 'built', g, {grow:'pop', deep:true, label:'Fish ladder', lpri:1, anchor:[29.2, hwR(29,'eng') - 0.3, 21.5 + 5]}); }
  /* combined sewer outfalls, then their caps */
  { const OUTF = [[34,1],[41,-1],[54,1],[62.5,-1],[66,1],[81,-1],[90,1],[99,-1]];
    const pipes = new THREE.Group(), caps = new THREE.Group(), plumes = new THREE.Group();
    const pm = M(0x55524C), cm = M(0x8A857A), plm = new THREE.MeshBasicMaterial({color:0x6B5A2E, transparent:true, opacity:.6, depthWrite:false});
    for(const [x, side] of OUTF){
      const hw = hwR(x, 'eng'), y = pl(WS.eng, x) + 2.2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), pm); p.rotation.x = Math.PI/2; const pg = new THREE.Group(); frameAt(pg, x, side*(hw - 0.12), y); pg.add(p); pipes.add(pg);
      const q = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), cm); q.rotation.x = Math.PI/2; const qg = new THREE.Group(); frameAt(qg, x, side*(hw - 0.005), y); qg.add(q); caps.add(qg);
      const xp = x + 1.2, pc = new THREE.Mesh(new THREE.CircleGeometry(1, 20), plm);
      pc.rotation.x = -Math.PI/2; pc.scale.set(0.75, 0.32, 1); pc.renderOrder = 3;
      const cg = new THREE.Group(); frameAt(cg, xp, side*(hwR(xp, 'eng') - 0.5), pl(WS.eng, xp) + 0.2); cg.add(pc); plumes.add(cg);
    }
    feat('outfalls', [3,4], 'built', pipes, {grow:'pop', label:'Outfalls', lpri:1, anchor:[54, hwR(54,'eng') - 0.15, pl(WS.eng,54) + 7]});
    feat('outfalls', [3,4], 'built', plumes, {grow:'pop', noPick:true, apply:i => { plm.opacity = i === 4 ? .64 : .28; }});
    feat('outfalls', [5,8], 'built', caps, {grow:'pop'}); }
  /* mussels */
  for(const [range, e, n, spread] of [[[0,2], E[0], 300, .85], [[3,5], E[3], 220, .8], [[7,8], E[7], 60, .75]]){
    feat('mussels', range, 'life', musselSet(e, n, 44, 108, spread), {grow:'pop', label:'Mussel beds', lpri:2, anchor:[69, -0.8, bedOf(69, e.bed) + 8]});
  }
  { const g = new THREE.Group();
    for(const x of [50, 58, 67, 79, 88]){
      const zR = (Math.round(x) % 2 ? -0.7 : 0.7), base = gFt(x, zR, E[6], true);
      const pin = pinGroup(0x6BA4E8, pl(WS.eng, x) + 5 - base); frameAt(pin, x, zR, base); g.add(pin);
    }
    feat('mussels', [6,6], 'life', g, {grow:'pop', label:'Mussels relocated', lpri:1, anchor:[67, 0.7, pl(WS.eng, 67) + 9]}); }
  /* 2026 construction */
  { const cw = new THREE.Group(), cur = new THREE.Group(), eq = new THREE.Group(), rockM = M(0x9C8A6A), ym = M(0xF2C230, {roughness:.5, emissive:0x2A1D00});
    const bits = [];
    const CW = [[59.2, 1, 2.3], [51.8, -1, 2.0], [70.6, 1, 2.6]];
    CW.forEach(([x, side, len]) => {
      const hw = hwR(x, 'eng'), zc = side*(hw - len/2), topFt = pl(WS.eng, x) + 1.3, baseFt = bedE(x) - 0.3, h = Y(topFt) - Y(baseFt);
      const g = new THREE.Group(); frameAt(g, x, zc, baseFt);
      g.add(box(0.5, h, len, rockM, 0, h/2, 0)); cw.add(g);
      for(let r = 0; r < 26; r++) bits.push([x + (Math.random() - .5)*0.9, topFt, zc + (Math.random() - .5)*len, 0.05 + Math.random()*0.06]);
      const ex = excavator(side); frameAt(ex, x + 0.03, side*(hw - len + 0.3), topFt); eq.add(ex);
      const pool = pl(WS.eng, x - 1.5) + 0.2;
      const pts = [[x - 3.2, side*(hw - 0.1)], [x - 2.6, side*(hw - len - 0.45)], [x - 0.9, side*(hw - len - 0.65)], [x + 0.25, side*(hw - len - 0.25)]];
      const curve = new THREE.CatmullRomCurve3(pts.map(([px, pz]) => { const p = Wr(px, pz, pool); return new THREE.Vector3(p[0], p[1], p[2]); }));
      cur.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.045, 6, false), ym));
    });
    cw.add(instanced(bits, new THREE.IcosahedronGeometry(1, 0), ([x, ft, zR, r], d, col) => {
      const p = Wr(x, zR, ft); d.position.set(p[0], p[1] + 0.01, p[2]); d.rotation.set(Math.random()*3, Math.random()*3, 0); d.scale.set(r, r*0.7, r);
      const v = 0.45 + Math.random()*0.2; col.setRGB(v, v*0.93, v*0.82);
    }));
    feat('causeway', [6,6], 'built', cw, {grow:'pop', label:'Causeways', lpri:1, anchor:[59.2, hwR(59.2,'eng') - 1.2, pl(WS.eng, 59.2) + 8]});
    feat('curtain', [6,6], 'built', cur, {grow:'pop', label:'Turbidity curtain', lpri:1, anchor:[67.4, hwR(67,'eng') - 3.0, pl(WS.eng, 67) + 5]});
    feat('equipment', [6,6], 'built', eq, {grow:'pop', label:'Excavators', lpri:2, anchor:[51.8, -(hwR(51.8,'eng') - 1.7), pl(WS.eng, 51.8) + 9]});
    const cof = new THREE.Group(), sp = M(0x4A4F52, {roughness:.5, metalness:.3});
    { const x0 = 45.4, x1 = 48.8, hw = hwR(47, 'eng'), zi = -hw + 0.06, zo = -hw + 1.5;
      const bot = bedE(47) - 0.5, top = pl(WS.eng, 46) + 2, h = Y(top) - Y(bot);
      const g = new THREE.Group(); frameAt(g, (x0 + x1)/2, (zi + zo)/2, bot);
      const dx = xr(x1) - xr(x0);
      g.add(box(dx, h, 0.03, sp, 0, h/2, (zo - zi)/2));
      g.add(box(0.03, h, zo - zi, sp, -dx/2, h/2, 0));
      g.add(box(0.03, h, zo - zi, sp, dx/2, h/2, 0)); cof.add(g);
      feat('cofferdam', [6,6], 'built', cof, {grow:'pop', label:'Cofferdam', lpri:1, anchor:[47.1, zo, top + 5]}); }
    const stg = new THREE.Group(), pile = M(0x9A9486), truck = M(0xE9E3D5), tcab = M(0xF3722C);
    for(const [x, dz, r] of [[66,1.0,0.32],[68.5,1.7,0.28],[71,0.9,0.35],[73.5,1.85,0.25],[75.3,1.1,0.28]]){
      const zR = hwR(x, 'eng') + dz, y = bankTop(x, 'urban', 1);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, r*0.8, 7), pile); const g = new THREE.Group(); frameAt(g, x, zR, y); cone.position.y = r*0.4; g.add(cone); stg.add(g);
    }
    for(const [x, dz] of [[69.5, 2.45],[72.6, 2.55]]){
      const zR = hwR(x, 'eng') + dz, y = bankTop(x, 'urban', 1), g = new THREE.Group(); frameAt(g, x, zR, y);
      g.add(box(0.45, 0.15, 0.2, truck, 0, 0.11, 0)); g.add(box(0.14, 0.14, 0.2, tcab, 0.3, 0.1, 0)); stg.add(g);
    }
    feat('staging', [6,6], 'built', stg, {grow:'pop', label:'Staging area', lpri:1, anchor:[70.5, hwR(70.5,'eng') + 1.7, bankTop(70.5,'urban',1) + 9]}); }
  /* fall 2027: rock where the dams were */
  { const arch = [];
    for(const xc of [58.4, 60.4, 62.4]){
      const hw = halfW(xc, 'eng');
      for(let j = 0; j < 19; j++){ const t = -0.95 + 1.9*j/18; arch.push([xc - 1.5*(1 - t*t), t*hw, 0.04 + Math.random()*0.02]); }
    }
    feat('arches', [7,8], 'rock', boulderSet(arch, E[7]), {grow:'pop', label:'Boulder arches', lpri:1, anchor:[60, 0, pl(WS.restored, 60) + 7]});
    const rif = [];
    for(let k = 0; k < 80; k++){ const x = 71 + Math.random()*3.2; rif.push([x, (Math.random()*2 - 1)*halfW(x, 'eng')*0.9, 0.02 + Math.random()*0.015]); }
    feat('riffle', [7,8], 'rock', boulderSet(rif, E[7]), {grow:'pop', label:'Riffle', lpri:1, anchor:[72.6, -0.6, pl(WS.restored, 72.6) + 6]});
    const hab = [], avoid = x => [44,65,76,84,94].some(b => Math.abs(x - b) < 1.4) || (x > 55.5 && x < 63.2) || (x > 70.5 && x < 74.6);
    while(hab.length < 140){ const x = 45 + Math.random()*49; if(avoid(x)) continue; hab.push([x, (Math.random()*2 - 1)*halfW(x, 'eng')*0.8, 0.03 + Math.random()*0.025]); }
    feat('boulders', [7,8], 'rock', boulderSet(hab, E[7]), {grow:'pop', label:'Habitat boulders', lpri:2, anchor:[49, 0.9, pl(WS.restored, 49) + 6]});
    const jh = [];
    for(const [x0, side] of [[80, 1], [85.5, -1], [90, 1]]){
      const hw = halfW(x0, 'eng');
      for(let j = 0; j < 7; j++){ const t = j/6; jh.push([x0 - 2.8*t, side*hw*(0.96 - 0.5*t), 0.04]); }
      for(const [dx, dd] of [[-2.35, .37], [-1.7, .3], [-1.0, .31]]) jh.push([x0 + dx, side*hw*dd, 0.035]);
    }
    feat('jhooks', [7,8], 'rock', boulderSet(jh, E[7]), {grow:'pop', label:'J-hooks', lpri:2, anchor:[85, -hwR(85,'eng')*0.6, pl(WS.restored, 85) + 6]});
    const bs = gFt(61.8, 0, E[7], true), pin = pinGroup(0xD3A253, pl(WS.restored, 61.8) + 6 - bs); frameAt(pin, 61.8, 0, bs);
    feat('sturgeon', [7,8], 'life', pin, {grow:'all', label:'Sturgeon habitat', lpri:2, anchor:[61.8, 0, pl(WS.restored, 61.8) + 8]}); }
  /* after 2027: the Upper Reach options, drawn as ghosts */
  { const gm = new THREE.MeshBasicMaterial({color:0x9A8FBF, transparent:true, opacity:.26, depthWrite:false, side:THREE.DoubleSide});
    const lm = new THREE.LineDashedMaterial({color:0xC3B9E6, dashSize:.18, gapSize:.12});
    for(const [id, x, lab] of [['optNow', 28, 'Option: present site'], ['optHalf', 19, 'Option: half a mile up'], ['optMile', 8.7, 'Option: a mile up']]){
      const hw = hwR(x, 'eng') + 0.2, bot = x === 28 ? rockTop(28, 0) - 1.2 : bedE(x) - 0.5, top = pl(WS.eng, x - 0.6) + 3.2, h = Y(top) - Y(bot);
      const gg = new THREE.Group(); frameAt(gg, x, 0, bot);
      const geo = new THREE.BoxGeometry(x === 28 ? 0.4 : 0.2, h, hw*2);
      const m = new THREE.Mesh(geo, gm); m.position.y = h/2; m.renderOrder = 4; gg.add(m);
      const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lm); ln.position.y = h/2; ln.computeLineDistances(); gg.add(ln);
      feat(id, [8,8], 'built', gg, {grow:'y', deep:true, label:lab, lpri:1, anchor:[x, hw*0.15, top + 6]});
    } }
  /* staff gauge near Fulton Street, reads the live gage height in the construction era */
  { const x = 95, hw = hwR(x, 'eng'), zR = hw - 0.1, g0 = -DATUM, g1 = 26 - DATUM, h = Y(g1) - Y(g0);
    const g = new THREE.Group(); frameAt(g, x, zR, g0);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), new THREE.MeshBasicMaterial({map:gaugeTex()})); post.position.y = h/2; g.add(post);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 20), new THREE.MeshBasicMaterial({color:0x307FE2}));
    ring.rotation.x = Math.PI/2; ring.visible = false; g.add(ring); R.gaugeRing = ring;
    feat('gauge', [5,8], 'built', g, {grow:'y', deep:true, label:'Gauge', lpri:2, anchor:[x, zR, g1 + 4]}); }
  /* people and places */
  { const x = 68, zN = hwR(x, 'natural') + 1.2, zU = hwR(x, 'eng') + 1.4;
    const b0 = gFt(x, zN, E[0], true), b1 = gFt(x, zN, E[1], true), b3 = bankTop(x, 'urban', 1);
    const p0 = pinGroup(0xD6CDB6, 9); frameAt(p0, x, zN, b0);
    const p1 = pinGroup(0xD6CDB6, 9); frameAt(p1, x, zN, b1);
    const p3 = pinGroup(0xD6CDB6, 9); frameAt(p3, x, zU, b3);
    feat('village', [0,0], 'markers', p0, {grow:'all', label:'Odawa village', lpri:1, anchor:[x, zN, b0 + 12]});
    feat('homeland', [1,2], 'markers', p1, {grow:'all', label:'Anishinaabe homeland', lpri:2, anchor:[x, zN, b1 + 12]});
    feat('homeland', [3,8], 'markers', p3, {grow:'all', label:'Anishinaabe homeland', lpri:2, anchor:[x, zU, b3 + 12]}); }
  feat('forest', [0,2], 'ground', bankTrees(), {grow:'pop', noPick:true});
  feat('rapids', [0,0], 'markers', new THREE.Group(), {label:'The rapids', lpri:1, anchor:[64, 0, pl(WS.natural, 64) + 6]});
  feat('anab', [5,8], 'markers', new THREE.Group(), {label:'Ah-Nab-Awen Park', lcls:'park', lpri:2, cond:i => i !== 6, anchor:[70, hwR(70,'eng') + 1.4, bankTop(70,'urban',1) + 4]});
  feat('lyon', [6,8], 'markers', new THREE.Group(), {label:'Lyon Square', lcls:'park', lpri:2, anchor:[71, -(hwR(71,'eng') + 0.5), bankTop(71,'urban',-1) + 4]});
}


/* ---------- the city, from OpenStreetMap ----------
   data/city.json is written by scripts/city.mjs (a GitHub Action runs it).
   If it is missing the page asks Overpass directly, and if that fails the
   landmark boxes stand in. Buildings, parks, roads and trees. */
const CITY_BB = '42.9505,-85.6895,43.0005,-85.6605';
const CITY_Q = `[out:json][timeout:45];(way["building"](${CITY_BB});way["leisure"~"^(park|garden|playground|pitch|dog_park)$"](${CITY_BB});way["landuse"~"^(grass|recreation_ground|cemetery|village_green)$"](${CITY_BB});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link)$"](${CITY_BB}););out geom;`;
function osmHeight(t){
  const num = s => { if(!s) return null; const m = String(s).match(/([\d.]+)\s*(ft|feet|')?/); if(!m) return null; const v = parseFloat(m[1]); return isFinite(v) ? (m[2] ? v*0.3048 : v) : null; };
  let h = num(t.height); if(h) return Math.min(h, 220);
  const lv = parseFloat(t['building:levels']); if(isFinite(lv) && lv > 0) return Math.min(lv*3.3 + 1, 220);
  const b = t.building || '';
  if(/house|residential|garage|shed|detached|hut/.test(b)) return 6;
  if(/church|cathedral/.test(b)) return 15;
  if(/parking|industrial|warehouse|retail|commercial|office|apartments|hotel/.test(b)) return 11;
  return 8;
}
function compactCity(osm){
  const out = {buildings:[], parks:[], roads:[], src:'overpass'};
  for(const el of (osm.elements || [])){
    if(el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags || {}, pts = el.geometry.map(g => [Math.round(g.lat*1e6)/1e6, Math.round(g.lon*1e6)/1e6]);
    if(t.building){ if(pts.length > 4 && pts.length < 400) out.buildings.push({p:pts.slice(0, -1), h:Math.round(osmHeight(t)*10)/10, n:t.name || ''}); }
    else if(t.highway){ out.roads.push({p:pts, w:/motorway|trunk/.test(t.highway) ? 26 : /primary/.test(t.highway) ? 16 : /secondary/.test(t.highway) ? 13 : /tertiary/.test(t.highway) ? 11 : 8}); }
    else if(pts.length > 3) out.parks.push({p:pts.slice(0, -1), n:t.name || ''});
  }
  return out;
}
async function fetchCity(){
  try{ const r = await fetch('./data/city.json', {cache:'force-cache'}); if(r.ok){ const j = await r.json(); if(j && j.buildings && j.buildings.length) return j; } }catch(e){}
  const r = await fetch('https://overpass-api.de/api/interpreter', {method:'POST', body:'data=' + encodeURIComponent(CITY_Q)});
  if(!r.ok) throw new Error('overpass ' + r.status);
  return compactCity(await r.json());
}
function inside(pt, poly){ let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if(((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0])*(pt[1] - a[1])/(b[1] - a[1]) + a[0])) c = !c; } return c; }
function buildCity(city){
  if(!city || !city.buildings) return;
  const bpos = [], bnor = [], bcol = [], bkey = [];
  const ppos = [], pcol = [], rpos = [], rcol = [];
  const trees = [];
  const cc = new THREE.Color();
  const push = (arr, ...v) => { for(const x of v) arr.push(x); };
  const groundAt = st => bankTop(st.x, 'urban', st.d < 0 ? -1 : 1);
  const inRibbon = st => st.x > X0 + 0.5 && st.x < X1 - 0.5 && Math.abs(st.z) < Z1 - 0.5;
  /* buildings */
  for(const B of city.buildings){
    const w = B.p.map(([la, ln]) => toXZ(la, ln)); if(w.length < 3) continue;
    let cx = 0, cz2 = 0; for(const q of w){ cx += q[0]; cz2 += q[1]; } cx /= w.length; cz2 /= w.length;
    const st = inv(cx, cz2); if(!inRibbon(st)) continue;
    if(Math.abs(st.z) < halfW(st.x, 'eng')*0.9 && st.x > 20) continue;      /* nothing standing in the river */
    const base = Y(groundAt(st) + 0.3), top = base + Math.max(3, B.h || 8)/MPU;
    let key = 'building';
    for(const L of LANDMARKS){ const p = toXZ(L.lat, L.lng); if(Math.hypot(p[0] - cx, p[1] - cz2)*MPU < 75){ key = L.k; break; } }
    const v = 0.6 + hash(cx*3.1, cz2*7.7)*0.1; cc.setRGB(v*1.0, v*0.985, v*0.955);
    const roof = cc.clone().multiplyScalar(1.07);
    /* winding: make it counter clockwise in xz for outward normals */
    let area = 0; for(let i = 0; i < w.length; i++){ const a = w[i], b = w[(i + 1) % w.length]; area += a[0]*b[1] - b[0]*a[1]; }
    const pts = area > 0 ? w.slice().reverse() : w;
    for(let i = 0; i < pts.length; i++){
      const a = pts[i], b = pts[(i + 1) % pts.length], nx = b[1] - a[1], nz = -(b[0] - a[0]), L2 = Math.hypot(nx, nz) || 1;
      const n = [nx/L2, 0, nz/L2];
      push(bpos, a[0], base, a[1], b[0], base, b[1], b[0], top, b[1], a[0], base, a[1], b[0], top, b[1], a[0], top, a[1]);
      for(let k = 0; k < 6; k++){ push(bnor, ...n); push(bcol, cc.r, cc.g, cc.b); }
      bkey.push(key, key);
    }
    const shape = pts.map(q => new THREE.Vector2(q[0], q[1]));
    let tris = [];
    try{ tris = THREE.ShapeUtils.triangulateShape(shape, []); }catch(e){ tris = []; }
    for(const t of tris){
      for(const idx of [t[0], t[2], t[1]]){ push(bpos, pts[idx][0], top, pts[idx][1]); push(bnor, 0, 1, 0); push(bcol, roof.r, roof.g, roof.b); }
      bkey.push(key);
    }
  }
  /* parks and trees */
  for(const P of city.parks || []){
    const w = P.p.map(([la, ln]) => toXZ(la, ln)); if(w.length < 3) continue;
    const sts = w.map(q => inv(q[0], q[1])); if(!sts.some(inRibbon)) continue;
    const shape = w.map(q => new THREE.Vector2(q[0], q[1]));
    let tris = []; try{ tris = THREE.ShapeUtils.triangulateShape(shape, []); }catch(e){ continue; }
    let area = 0; for(let i = 0; i < w.length; i++){ const a = w[i], b = w[(i + 1) % w.length]; area += a[0]*b[1] - b[0]*a[1]; }
    const ys = sts.map(st => Y(groundAt(st) + 0.5));
    for(const t of tris){ const order = area > 0 ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]]; for(const idx of order){ push(ppos, w[idx][0], ys[idx], w[idx][1]); push(pcol, 0.56, 0.73, 0.45); } }
    const xs = w.map(q => q[0]), zs = w.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const want = Math.min(60, Math.max(3, Math.round(Math.abs(area)*MPU*MPU/900)));
    for(let k = 0, tries = 0; k < want && tries < want*12; tries++){
      const q = [x0 + hash(tries, area)*(x1 - x0), z0 + hash(area, tries + 1)*(z1 - z0)];
      if(!inside(q, w)) continue; const st = inv(q[0], q[1]); if(!inRibbon(st)) continue;
      trees.push([q[0], Y(groundAt(st) + 0.5), q[1]]); k++;
    }
  }
  /* roads */
  for(const Rd of city.roads || []){
    const w = Rd.p.map(([la, ln]) => toXZ(la, ln)); if(w.length < 2) continue;
    const half = (Rd.w || 9)/MPU/2;
    for(let i = 0; i < w.length - 1; i++){
      const a = w[i], b = w[i + 1], sa = inv(a[0], a[1]), sb = inv(b[0], b[1]);
      if(!inRibbon(sa) && !inRibbon(sb)) continue;
      if(Math.abs(sa.z) < halfW(sa.x, 'eng') + 1.2 && Math.abs(sb.z) < halfW(sb.x, 'eng') + 1.2) continue;   /* the bridges carry the streets over the water */
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = Math.hypot(dx, dz) || 1, nx = -dz/L2*half, nz = dx/L2*half;
      const ya = Y(groundAt(sa) + 0.25), yb = Y(groundAt(sb) + 0.25);
      push(rpos, a[0] + nx, ya, a[1] + nz, b[0] + nx, yb, b[1] + nz, b[0] - nx, yb, b[1] - nz, a[0] + nx, ya, a[1] + nz, b[0] - nx, yb, b[1] - nz, a[0] - nx, ya, a[1] - nz);
      for(let k = 0; k < 6; k++) push(rcol, 0.9, 0.885, 0.85);
    }
  }
  const mk = (pos, col, nor, o) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); if(nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({vertexColors:true, roughness:.92, metalness:0}, o || {}))); m.frustumCulled = false; return m; };
  const grp = new THREE.Group();
  if(bpos.length){ const bm = mk(bpos, bcol, bnor, {flatShading:true}); bm.userData.cityKeys = bkey; bm.castShadow = true; bm.receiveShadow = true; grp.add(bm); R.pick.push(bm); R.pickF.push(bm); }
  if(ppos.length){ const pm = mk(ppos, pcol, null); pm.receiveShadow = true; pm.renderOrder = 1; grp.add(pm); }
  if(rpos.length){ const rm = mk(rpos, rcol, null); rm.receiveShadow = true; rm.renderOrder = 1; grp.add(rm); }
  if(trees.length) grp.add(treeSet(trees));
  R.scene.add(grp);
  R.city = {on:true, grp, n:bpos.length/9, trees:trees.length};
  grp.visible = false;
  R.cityFeat = feat('city', [5,8], 'built', grp, {grow:'pop', noPick:true});
  R.cityFeat.obj.traverse(m => { if(m.isMesh && m.userData.cityKeys) m.userData.f = null; if(m.isMesh && !m.userData.cityKeys && !m.isInstancedMesh) m.castShadow = false; });
}
/* trees: a trunk and a canopy, instanced */
function treeSet(list){
  const g = new THREE.Group();
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 5), M(0x6B5236, {roughness:1}), list.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M(0xFFFFFF, {roughness:.95}), list.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, z], k) => {
    const h = 0.16 + hash(k, 3)*0.14, r = 0.07 + hash(k, 5)*0.06;
    d.position.set(x, y + h*0.45, z); d.scale.set(1, h*0.9, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); trunk.setMatrixAt(k, d.matrix);
    d.position.set(x, y + h*0.9 + r*0.6, z); d.scale.set(r, r*1.1, r); d.rotation.set(hash(k, 7), hash(k, 8)*3, 0); d.updateMatrix(); crown.setMatrixAt(k, d.matrix);
    c.setHSL(0.31 + hash(k, 9)*0.05, 0.42, 0.28 + hash(k, 11)*0.12); crown.setColorAt(k, c);
  });
  trunk.instanceMatrix.needsUpdate = true; crown.instanceMatrix.needsUpdate = true; if(crown.instanceColor) crown.instanceColor.needsUpdate = true;
  trunk.castShadow = crown.castShadow = true; trunk.receiveShadow = crown.receiveShadow = true;
  g.add(trunk); g.add(crown); return g;
}
/* riverbank trees for the eras before the city, built from the model alone */
function bankTrees(){
  const list = [];
  for(let k = 0; k < 420; k++){
    const x = X0 + 1 + hash(k, 21)*(X1 - X0 - 2), side = k % 2 ? 1 : -1, hw = halfW(x, 'natural');
    const z = side*(hw + 2.5 + hash(k, 23)*24);
    if(Math.abs(z) > Z1 - 1) continue;
    const p = W(x, z, groundFt(x, z, ERAS[0], true) + 0.3); list.push([p[0], p[1], p[2]]);
  }
  return treeSet(list);
}
const hash = (a, b) => { const s = Math.sin(a*127.1 + b*311.7)*43758.5453; return s - Math.floor(s); };

function buildSection(){
  const h = Y(42) - Y(BOTTOM), geo = new THREE.PlaneGeometry(SZ*2*ZS, h);
  geo.rotateY(Math.PI/2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0xE9E3D5, transparent:true, opacity:.07, side:THREE.DoubleSide, depthWrite:false}));
  const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color:0x4FD6C6, transparent:true, opacity:.8}));
  m.renderOrder = 5; ln.renderOrder = 5;
  const g = new THREE.Group(); g.add(m); g.add(ln);
  R.scene.add(g); R.secPlane = g;
  placeSection(65);
}
function placeSection(x){ const p = Wr(x, 0, 0); const c = curveAt(xr(x)); R.secPlane.position.set(p[0], (Y(42) + Y(BOTTOM))/2, p[2]); R.secPlane.rotation.y = Math.atan2(-c.tz, c.tx); }

/* ============================================================================
   INTERFACE, CONTROLS, LOOP
   ========================================================================= */
let HOST = null, PLAY = null, SECX = 65;
const ndc = { x:0, y:0 };
const ERA_ICON = ['waves','mill','logs','dam','pollution','drop','build','rock','question'];

/* camera views are defined on stations and resolved to world coordinates */
const VIEWDEFS = {
  overview:{x:62, z:0, r:150, th:1.9, ph:1.05, tall:{r:230, th:1.58, ph:0.9}},
  sixth:   {x:27.5, z:0, r:30, th:2.3, ph:0.95},
  down:    {x:70, z:-0.4, r:46, th:2.45, ph:0.98, tall:{r:60, th:1.58, ph:0.86}},
  lower:   {x:74, z:0, r:40, th:2.1, ph:0.9, tall:{r:56, th:1.58, ph:0.86}},
  amp:     {x:104, z:-0.3, r:38, th:2.5, ph:0.95},
  under:   {x:50, z:9, r:95, th:1.4, ph:1.33},
  plan:    {x:60, z:0, r:210, th:1.5708, ph:0.06, tall:{r:250, th:1.5708, ph:0.06}}
};
function viewOf(name){
  const v = VIEWDEFS[name]; if(!v) return null;
  const p = Wr(v.x, v.z, 0), tall = R.w && R.h && R.w/R.h < 0.9 && v.tall ? v.tall : {};
  return {tx:p[0], ty:p[1] - 0.3, tz:p[2], r:tall.r || v.r, th:tall.th !== undefined ? tall.th : v.th, ph:tall.ph || v.ph};
}
const CONF_VAR = {live:'var(--live)', official:'var(--official)', stable:'var(--stable)', seasonal:'var(--seasonal)', planned:'var(--planned)', scenario:'var(--scenario)'};

function shell(){
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  return `
  <div class="tw-head">
    <div class="tw-title"><h3>${ic('cube')} The river in 3D</h3>
      <p>Downtown on the real map, Ann Street to Wealthy Street. Pick a moment, peel back the ground, tap anything.</p></div>
    <div class="tw-views" role="group" aria-label="Camera views">
      <button data-v="overview" title="Whole reach">${ic('expand')}<span>All</span></button>
      <button data-v="sixth" title="Sixth Street Dam">${ic('dam')}<span>Dam</span></button>
      <button data-v="down" class="on" title="Downtown">${ic('building')}<span>Downtown</span></button>
      <button data-v="lower" title="Lower Reach">${ic('rock')}<span>Rapids</span></button>
      <button data-v="amp" title="Amphitheater">${ic('music')}<span>Amp</span></button>
      <button data-v="under" title="Underground">${ic('layers')}<span>Under</span></button>
      <button data-v="plan" title="Map view, north up">${ic('map')}<span>Map</span></button>
    </div>
  </div>
  <div class="tw-main">
    <div class="tw-stage" id="tw-stage" aria-label="3D model of the Grand River through downtown Grand Rapids">
      <canvas></canvas>
      <div class="tw-labs" id="tw-labs"></div>
      <div class="tw-hud" id="tw-hud"></div>
      <div class="tw-base" id="tw-base" role="group" aria-label="Ground">
        <button data-b="sat" class="on" title="Satellite photo">${ic('satellite')}</button>
        <button data-b="map" title="Street map">${ic('map')}</button>
        <button data-b="none" title="Model only">${ic('cube')}</button>
      </div>
      <div class="tw-hint" id="tw-hint">${coarse ? 'Drag sideways to turn. Pinch to zoom. Tap anything.' : 'Drag to turn. Ctrl and scroll, or the buttons, to zoom. Click anything.'}</div>
      <div class="tw-zoom"><button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">&minus;</button></div>
      <div class="tw-attr" id="tw-attr"></div>
      <div class="tw-tip" id="tw-tip"></div>
    </div>
    <aside class="tw-side">
      <div class="tw-info" id="tw-info" aria-live="polite"></div>
      <div class="tw-sec">
        <div class="tw-sec-h"><span>${ic('layers')} Under the river</span><span id="tw-at"></span></div>
        <svg id="tw-svg" viewBox="0 0 400 256" role="img" aria-label="Cross-section of the river and the ground beneath it"></svg>
        <input class="tw-range" id="tw-x" type="range" min="0" max="116" step="0.5" value="65" aria-label="Move the cross-section along the river">
        <div class="tw-sec-f"><span>Ann St</span><span>Slide the cut along the river</span><span>Wealthy St</span></div>
      </div>
    </aside>
  </div>
  <div class="tw-time">
    <button class="tw-play" id="tw-play" title="Play through time">${ic('play')}<span>Play</span></button>
    <div class="tw-eras" id="tw-eras" role="tablist" aria-label="Moments in time"></div>
  </div>
  <div class="tw-layers" id="tw-layers">
    <button class="tw-l" data-l="water" aria-pressed="true" title="Water">${ic('drop')}<span>Water</span></button>
    <button class="tw-l" data-l="sediment" aria-pressed="true" title="Sediment and fill">${ic('layers')}<span>Ground</span></button>
    <button class="tw-l" data-l="structures" aria-pressed="true" title="Structures">${ic('building')}<span>Built</span></button>
    <button class="tw-l" data-l="labels" aria-pressed="true" title="Labels">${ic('tag')}<span>Labels</span></button>
    <button class="tw-l" data-l="flood" aria-pressed="false" title="2013 record flood">${ic('flood')}<span>2013 flood</span></button>
    <span class="tw-note">True scale above the riverbed. Positions approximate.</span>
  </div>`;
}

/* ---------- live data, read defensively ---------- */
function reading(k){ try{ return (typeof LIVE !== 'undefined' && LIVE.ok) ? pick(k) : null; }catch(e){ return null; } }
function liveFlood(){ if(ERA !== 6) return 0; const s = reading('stage'); return s ? clamp((s.v - 6)/(21.85 - 6), 0, 1) : 0; }
function effFlood(){ return Math.max(S.flood && ERA >= 5 ? 1 : 0, liveFlood()); }
function liveFlowK(){ const q = reading('flow'); return q ? clamp(q.v/2600, 0.35, 3.5) : 1; }
function liveChip(){
  if(typeof LIVE === 'undefined' || !LIVE.ok) return `${ic('gauge')} Gauge offline. Water shown is typical, not measured.`;
  const t = reading('tempC'), q = reading('flow'), s = reading('stage'), bits = [];
  if(t) bits.push(`${fmt(cToF(t.v), 1)} °F`); if(q) bits.push(`${fmt(q.v)} cfs`); if(s) bits.push(`gage ${fmt(s.v, 2)} ft`);
  return bits.length ? `${ic('gauge')} Live: ${bits.join(' · ')}` : `${ic('gauge')} Gauge not reporting.`;
}

/* ---------- morphing between states ---------- */
function retarget(instant){
  if(!R || !R.gl) return;
  const T = R.ter, K = R.sk, Wt = R.wat, Cp = R.cap;
  const tp = T.g.attributes.position.array;
  for(let k = 0; k < T.n; k++) T.y0[k] = tp[k*3 + 1];
  T.c0.set(T.g.attributes.color.array);
  const sp = K.g.attributes.position.array;
  for(let k = 0; k < K.nv; k++) K.y0[k] = sp[k*3 + 1];
  K.c0.set(K.g.attributes.color.array);
  Wt.p0.set(Wt.cur); Cp.p0.set(Cp.g.attributes.position.array);
  terrainTarget(ERA); skirtTarget(ERA); waterTarget(ERA); capTarget(ERA);
  const e = ERAS[ERA];
  R.wc0.copy(Wt.mesh.material.color); R.wc1.setHex(e.water);
  if(ERA === 6){ const tb = reading('turb'); if(tb) R.wc1.lerp(R.silt, clamp(tb.v/40, 0, 0.8)); }
  R.wo0 = Wt.mesh.material.opacity; R.wo1 = (S.water && S.sediment) ? (imageryOn() ? Math.min(0.9, e.op + 0.12) : e.op) : 0;
  if(R.wo1 > 0){ Wt.mesh.visible = true; Cp.mesh.visible = true; }
  R.par.tint = ERA === 4 ? [.55,.47,.24] : ERA <= 2 ? [.6,.8,.72] : [.55,.78,.76];
  R.par.flowK = ERA === 6 ? liveFlowK() : 1;
  for(const f of F){ f.from = f.k; f.to = wantOn(f, ERA) ? 1 : 0; if(f.to) f.obj.visible = f.grow !== 'pop' || f.k > 0.5; if(f.apply) f.apply(ERA); }
  R.labF.sort((a, b) => (a.lpri - (a.range[0] === a.range[1] ? 1 : 0)) - (b.lpri - (b.range[0] === b.range[1] ? 1 : 0)));
  const s = reading('stage');
  if(R.gaugeRing){ R.gaugeRing.visible = ERA === 6 && !!s; if(s) R.gaugeRing.position.y = Y(s.v - DATUM) - Y(-DATUM); }
  MORPH.t0 = performance.now(); MORPH.dur = (instant || RM) ? 1 : 1150; MORPH.on = true;
}
function applyGrow(f){
  const o = f.obj, s0 = o.userData.s0, k = f.k;
  if(f.grow === 'pop'){ o.visible = k > 0.5; return; }
  o.visible = k > 0.002;
  const s = Math.max(k, 0.002);
  if(f.grow === 'y') o.scale.set(s0.x, s0.y*s, s0.z); else o.scale.set(s0.x*s, s0.y*s, s0.z*s);
}
function stepMorph(now){
  if(!MORPH.on) return;
  const t = clamp((now - MORPH.t0)/MORPH.dur, 0, 1), k = t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  const T = R.ter, K = R.sk, Wt = R.wat, Cp = R.cap;
  const tp = T.g.attributes.position.array, tc = T.g.attributes.color.array;
  for(let q = 0; q < T.n; q++) tp[q*3 + 1] = T.y0[q] + (T.y1[q] - T.y0[q])*k;
  for(let q = 0; q < T.n*3; q++) tc[q] = T.c0[q] + (T.c1[q] - T.c0[q])*k;
  T.g.attributes.position.needsUpdate = true; T.g.attributes.color.needsUpdate = true;
  const sp = K.g.attributes.position.array, sc = K.g.attributes.color.array;
  for(let q = 0; q < K.nv; q++) sp[q*3 + 1] = K.y0[q] + (K.y1[q] - K.y0[q])*k;
  for(let q = 0; q < K.nv*3; q++) sc[q] = K.c0[q] + (K.c1[q] - K.c0[q])*k;
  K.g.attributes.position.needsUpdate = true; K.g.attributes.color.needsUpdate = true;
  for(let q = 0; q < Wt.cur.length; q++) Wt.cur[q] = Wt.p0[q] + (Wt.p1[q] - Wt.p0[q])*k;
  const cp = Cp.g.attributes.position.array;
  for(let q = 0; q < cp.length; q++) cp[q] = Cp.p0[q] + (Cp.p1[q] - Cp.p0[q])*k;
  Cp.g.attributes.position.needsUpdate = true;
  Wt.mesh.material.color.lerpColors(R.wc0, R.wc1, k);
  Wt.mesh.material.opacity = lerp(R.wo0, R.wo1, k);
  Cp.mesh.material.color.copy(Wt.mesh.material.color);
  Cp.mesh.material.opacity = Wt.mesh.material.opacity*0.72;
  for(const f of F){ if(f.from === f.to && f.k === f.to) continue; f.k = lerp(f.from, f.to, k); applyGrow(f); }
  if(t >= 1){
    MORPH.on = false;
    if(R.wo1 === 0){ Wt.mesh.visible = false; Cp.mesh.visible = false; }
    T.g.computeBoundingSphere(); K.g.computeBoundingSphere(); Wt.g.computeBoundingSphere();
    for(const f of F){ f.k = f.to; applyGrow(f); }
  }
}
function pulses(t){
  for(const f of F){
    if(!f.pulse) continue;
    const sel = SEL && SEL.key === f.key;
    if(ERA === 6 && !sel){ const v = 0.28 + 0.22*Math.sin(t*3.2); f.mats.forEach(m => m.emissive.setRGB(0.95*v, 0.45*v, 0.17*v)); f.pulsed = true; }
    else if(f.pulsed && !sel){ f.mats.forEach(m => m.emissive.setHex(0x000000)); f.pulsed = false; }
  }
}

/* ---------- camera ---------- */
function applyCam(){
  const c = R.cam, s = Math.sin(c.ph);
  R.camera.position.set(c.tx + c.r*s*Math.cos(c.th), c.ty + c.r*Math.cos(c.ph), c.tz + c.r*s*Math.sin(c.th));
  R.camera.lookAt(c.tx, c.ty, c.tz);
}
function goView(name, instant){
  const to = viewOf(name); if(!to || !R.gl) return;
  let d = to.th - R.cam.th; d = ((d + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; to.th = R.cam.th + d;
  HOST.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  R.viewName = name;
  if(instant || RM){ Object.assign(R.cam, to); R.tween = null; return; }
  R.tween = {from:Object.assign({}, R.cam), to, t0:performance.now(), dur:1000};
}
function stepTween(now){
  const tw = R.tween; if(!tw) return;
  const t = clamp((now - tw.t0)/tw.dur, 0, 1), k = 1 - Math.pow(1 - t, 3);
  for(const key of ['tx','ty','tz','r','th','ph']) R.cam[key] = lerp(tw.from[key], tw.to[key], k);
  if(t >= 1) R.tween = null;
}
function panBy(dx, dy){
  const c = R.cam, k = c.r*0.0016, s = Math.sin(c.th), co = Math.cos(c.th);
  c.tx = clamp(c.tx + (-s*dx - co*dy)*k, R.bb.x0, R.bb.x1);
  c.tz = clamp(c.tz + (co*dx - s*dy)*k, R.bb.z0, R.bb.z1);
}
function clearViews(){ HOST.querySelectorAll('[data-v]').forEach(b => b.classList.remove('on')); R.viewName = null; }

/* ---------- picking ---------- */
function shown(o){ while(o){ if(!o.visible) return false; o = o.parent; } return true; }
function rayAt(cx, cy, list){
  const r = R.canvas.getBoundingClientRect();
  ndc.x = ((cx - r.left)/r.width)*2 - 1; ndc.y = -((cy - r.top)/r.height)*2 + 1;
  R.ray.setFromCamera(ndc, R.camera);
  return R.ray.intersectObjects(list, false);
}
function pickAt(cx, cy){
  let water = null;
  for(const h of rayAt(cx, cy, R.pick)){
    const o = h.object;
    if(!shown(o)) continue;
    if(o.userData.water){ if(!water) water = {key:'water'}; continue; }
    if(o.userData.cityKeys){ const k = o.userData.cityKeys[h.faceIndex] || 'building'; return {key:k, f:F.find(x => x.key === k && x.anchor) || null}; }
    if(o.userData.f){ if(o.userData.f.k < 0.5) continue; return {key:o.userData.f.key, f:o.userData.f}; }
    if(water) return water;
    if(o.userData.skirt){
      const q = Math.floor(h.faceIndex/2), bandK = R.sk.quads[q*3 + 2], st = inv(h.point.x, h.point.z);
      if(bandK === 0 && S.sediment && Math.abs(st.z) < halfW(st.x, ERAS[ERA].w)) return {key:'L-bed'};
      return {key:BAND_KEYS[bandK]};
    }
    if(o.userData.terrain){
      if(!S.sediment) return {key:'L-lime'};
      const st = inv(h.point.x, h.point.z);
      return {key: Math.abs(st.z) < halfW(st.x, ERAS[ERA].w) ? 'L-bed' : 'L-cap'};
    }
  }
  return water;
}
let hoverT = 0;
function hoverAt(e){
  const now = performance.now(); if(now - hoverT < 70) return; hoverT = now;
  let hit = null;
  for(const h of rayAt(e.clientX, e.clientY, R.pickF)){ if(h.object.userData.cityKeys && shown(h.object)){ const k = h.object.userData.cityKeys[h.faceIndex]; hit = {key:k || 'building'}; break; } const f = h.object.userData.f; if(f && f.k > 0.5 && shown(h.object)){ hit = f; break; } }
  const tip = R.tip;
  if(hit && INFO[hit.key]){
    const r = R.stage.getBoundingClientRect();
    tip.textContent = INFO[hit.key].t; tip.style.display = 'block';
    tip.style.transform = `translate(${Math.round(e.clientX - r.left + 14)}px, ${Math.round(e.clientY - r.top + 12)}px)`;
    R.stage.style.cursor = 'pointer';
  } else { tip.style.display = 'none'; R.stage.style.cursor = ''; }
}

/* ---------- selection and the info panel ---------- */
function select(key, f, quiet){
  SEL = key ? {key, f} : null;
  for(const ff of F){
    const on = !!SEL && ff.key === key;
    for(const m of ff.mats){
      if(on){ if(m.userData.e0 === undefined) m.userData.e0 = ff.pulse ? 0 : m.emissive.getHex(); m.emissive.setHex(0x2E6A63); }
      else if(m.userData.e0 !== undefined){ m.emissive.setHex(m.userData.e0); delete m.userData.e0; }
    }
    if(ff.el) ff.el.classList.toggle('on', on);
  }
  showInfo(key);
  const a = f && f.anchor ? f.anchor : (key && F.find(x => x.key === key && x.anchor && x.to === 1) || {}).anchor;
  if(a && R.gl && !RM && !quiet){
    const p = Wr(a[0], a[1], 0);
    R.tween = {from:Object.assign({}, R.cam), to:Object.assign({}, R.cam, {tx:lerp(R.cam.tx, p[0], .6), tz:lerp(R.cam.tz, p[2], .6)}), t0:performance.now(), dur:700};
  }
  if(a && a[0] >= 0 && a[0] <= 116){ SECX = Math.round(a[0]*2)/2; R.range.value = SECX; renderSection(); }
}
function splitBody(html){
  const m = html.match(/^\s*(<p[^>]*>[\s\S]*?<\/p>)([\s\S]*)$/);
  return m ? {lead:m[1], rest:m[2].trim()} : {lead:html, rest:''};
}
function visibleFeats(){
  const seen = new Set();
  return F.filter(f => f.label && f.anchor && f.k > 0.5 && wantOn(f, ERA) && INFO[f.key] && !seen.has(f.key) && seen.add(f.key)).sort((a, b) => a.anchor[0] - b.anchor[0]);
}
function showInfo(key){
  const el = R.info, i = ERA, isEra = !key || !INFO[key];
  let tags, title, sub, body, q, reach, wiki = null, built = null;
  if(isEra){
    const e = ERAS[i]; reach = e.reach;
    tags = confTag(e.c); title = e.t; sub = e.y;
    body = e.body + `<p class="tw-look"><strong>Look for</strong> ${e.look}.</p>`;
    q = `Tell me about the Grand River in Grand Rapids during ${e.y.toLowerCase()}: ${e.t.toLowerCase()}.`;
  } else {
    const d = INFO[key]; reach = d.reach; wiki = d.wiki || null; built = d.y || null;
    tags = confTag(d.c(i)); title = d.t; sub = `${ERAS[i].y} · ${ERAS[i].t}`; body = d.b(i); q = d.ask;
  }
  const {lead, rest} = splitBody(body);
  const list = visibleFeats(), pos = list.findIndex(f => f.key === key);
  const prev = pos > 0 ? list[pos - 1] : (pos === -1 && list.length ? list[list.length - 1] : null), next = pos >= 0 && pos < list.length - 1 ? list[pos + 1] : (pos === -1 && list.length ? list[0] : null);
  el.innerHTML = `<div class="tw-tags">${tags}</div>
    <h4>${title}</h4><div class="tw-y">${sub}</div>
    ${wiki ? '<div class="tw-photo" id="tw-photo"></div>' : ''}
    ${lead}
    <div class="tw-stats"><div class="tw-stat"><b>${built ? 'Built' : 'Moment'}</b><span>${built || ERAS[i].y}</span></div><div class="tw-stat"><b>Reach</b><span>${REACHES[reach][0]}</span></div></div>
    ${isEra ? `<div class="tw-chips">${(ERAS[i].look || '').split(', ').slice(0, 4).map(s => `<span>${s.replace(/^the /, '')}</span>`).join('')}</div>` : ''}
    ${rest ? `<details class="tw-more"><summary>${ic('info')} More</summary>${rest}</details>` : ''}
    <div class="tw-acts"><button class="act" data-a="ask">${ic('ask')} Ask</button><button class="act" data-a="copy">${ic('copy')} Copy</button>${isEra ? '' : `<button class="act" data-a="back">${ic('back')} Era</button>`}</div>
    <div class="tw-nav"><button data-a="prev" ${prev ? '' : 'disabled'}>${ic('back')} ${prev ? prev.label : 'Prev'}</button><button data-a="next" ${next ? '' : 'disabled'}>${next ? next.label : 'Next'} ${ic('chevron')}</button></div>`;
  el.querySelector('[data-a="ask"]').onclick = () => { if(typeof ask === 'function') ask(q); };
  el.querySelector('[data-a="copy"]').onclick = ev => copy(`${title}\n${sub}\n\n${plain(body)}\n\n[River Brain model, ${REACHES[reach][0]}]`, ev.currentTarget);
  const bk = el.querySelector('[data-a="back"]'); if(bk) bk.onclick = () => select(null);
  const pv = el.querySelector('[data-a="prev"]'); if(pv && prev) pv.onclick = () => select(prev.key, prev);
  const nx = el.querySelector('[data-a="next"]'); if(nx && next) nx.onclick = () => select(next.key, next);
  el.scrollTop = 0;
  if(wiki && typeof photoAny === 'function'){
    const box = el.querySelector('#tw-photo');
    photoAny(wiki).then(p => {
      if(!box || !box.isConnected) return;
      if(p && p.img) box.innerHTML = `<a href="${p.link}" target="_blank" rel="noopener"><img src="${p.img}" alt="${title}" loading="lazy"><span>${ic('camera')} Wikipedia</span></a>`;
      else box.remove();
    });
  }
}
function renderSection(){
  const out = sectionSVG(SECX, ERA, S);
  R.svg.innerHTML = out.svg;
  R.at.textContent = out.station ? `at ${out.station}` : nearest(SECX);
  if(R.gl) placeSection(SECX);
}
function hud(){
  const e = ERAS[ERA];
  let h = `<div class="tw-chip era">${ic(ERA_ICON[ERA])} ${e.y}: <strong>${e.t}</strong></div>`;
  if(e.c === 'scenario') h += `<div class="tw-chip scn">${ic('question')} Scenario. Nothing chosen.</div>`;
  if(e.c === 'planned') h += `<div class="tw-chip pln">${ic('clock')} Expected, not built yet.</div>`;
  if(ERA === 6) h += `<div class="tw-chip lv">${liveChip()}</div>`;
  if(S.flood && ERA >= 5) h += `<div class="tw-chip">${ic('flood')} 2013 crest, 21.85 ft. The walls held.</div>`;
  if(!S.sediment) h += `<div class="tw-chip">${ic('layers')} Down to the limestone. Depths below the bed are stretched.</div>`;
  if(ERA >= 5 && R.cityFail && !(R.city && R.city.on)) h += `<div class="tw-chip dim">${ic('building')} City map data could not load. Landmarks only.</div>`;
  if(S.base !== 'none' && ERA < 5) h += `<div class="tw-chip dim">${ic('satellite')} Photo shows from 1991 onward.</div>`;
  else if(S.base !== 'none' && ERA >= 5 && !imageryOn()) h += `<div class="tw-chip dim">${R.baseFail === S.base ? ic('warn') + ' Map tiles could not load.' : ic('clock') + ' Loading the map…'}</div>`;
  R.hud.innerHTML = h;
  R.hudW = R.hud.offsetWidth + 16; R.hudH = R.hud.offsetHeight + 16;
  R.attr.textContent = imageryOn() ? R.base.attr : '';
  HOST.querySelectorAll('[data-b]').forEach(b => b.classList.toggle('on', b.dataset.b === S.base));
  R.stage.parentElement.parentElement.style.setProperty('--band', CONF_VAR[e.c]);
}
function syncUI(){
  HOST.querySelectorAll('.tw-e').forEach(b => { const on = +b.dataset.i === ERA; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    if(on){ const strip = b.parentElement, L = b.offsetLeft, Rr = L + b.offsetWidth; if(L < strip.scrollLeft) strip.scrollLeft = L; else if(Rr > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Rr - strip.clientWidth; } });
  const fb = HOST.querySelector('[data-l="flood"]');
  fb.disabled = ERA < 5; fb.title = ERA < 5 ? 'Available from the 2015 channel onward' : 'Show a 2013-level flood';
  hud();
}
function setEra(i, instant){
  ERA = clamp(i, 0, ERAS.length - 1);
  select(null, null, true);
  S.floodK = effFlood();
  syncUI(); retarget(instant); showInfo(null); renderSection();
}

/* ---------- labels projected from the model ---------- */
const PV = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function buildLabels(){
  const box = R.labs;
  for(const f of F){
    if(!f.label || !f.anchor) continue;
    const b = document.createElement('button');
    b.className = 'tw-lab' + (f.lcls ? ' ' + f.lcls : ''); b.type = 'button'; b.textContent = f.label;
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); select(f.key, f); });
    box.appendChild(b); f.el = b;
    const p = Wr(f.anchor[0], f.anchor[1], f.anchor[2]);
    f.av = new THREE.Vector3(p[0], p[1] + 0.08, p[2]); f.shown = false;
  }
  R.labF = F.filter(f => f.el).sort((a, b) => a.lpri - b.lpri);
}
function placeLabels(){
  const w = R.w, h = R.h, placed = [[0, 0, R.hudW || 0, R.hudH || 0]];
  for(const f of R.labF){
    let show = S.labels && f.k > 0.6 && (f.lpri === 1 || R.cam.r < 90 || (SEL && SEL.key === f.key));
    let x = 0, y = 0;
    if(show){
      PV.copy(f.av).project(R.camera);
      if(PV.z > 1 || Math.abs(PV.x) > 1.02 || Math.abs(PV.y) > 1.02) show = false;
      else { x = (PV.x + 1)/2*w; y = (1 - PV.y)/2*h; }
    }
    if(show){
      if(!f.shown){ f.el.style.display = 'block'; f.shown = true; }
      if(!f.lw){ f.lw = f.el.offsetWidth || 80; }
      const r = [x - f.lw/2, y - 24, x + f.lw/2, y - 2];
      if(r[0] < 4 || r[2] > w - 4 || r[1] < 4 || placed.some(p => !(r[2] < p[0] || r[0] > p[2] || r[3] < p[1] || r[1] > p[3]))) show = false;
      else { placed.push(r); f.el.style.transform = `translate(${Math.round(r[0])}px, ${Math.round(r[1])}px)`; }
    }
    if(!show && f.shown){ f.el.style.display = 'none'; f.shown = false; }
  }
}

/* ---------- wiring ---------- */
function interacted(){
  stopPlay();
  if(R.hint && !R.hintGone){ R.hint.style.opacity = '0'; R.hintGone = true; }
}
function nudgeHint(){
  if(!R.hint) return;
  R.hint.textContent = 'Hold ctrl and scroll to zoom, or use the buttons.';
  R.hint.style.opacity = '1'; R.hintGone = false;
  clearTimeout(R.hintT); R.hintT = setTimeout(() => { R.hint.style.opacity = '0'; R.hintGone = true; }, 1600);
}
function bindControls(){
  const st = R.stage, ptrs = new Map();
  let drag = null, pinch = null;
  st.addEventListener('contextmenu', e => e.preventDefault());
  st.addEventListener('pointerdown', e => {
    if(e.target.closest('.tw-lab, .tw-zoom, .tw-base')) return;
    try{ st.setPointerCapture(e.pointerId); }catch(_){}
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(ptrs.size === 1) drag = {moved:0, pan:e.button === 2 || e.shiftKey};
    if(ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = {d:Math.hypot(a.x - b.x, a.y - b.y), r:R.cam.r, mx:(a.x + b.x)/2, my:(a.y + b.y)/2}; }
    interacted();
  });
  st.addEventListener('pointermove', e => {
    if(!ptrs.has(e.pointerId)){ if(e.pointerType === 'mouse') hoverAt(e); return; }
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if(ptrs.size >= 2 && pinch){
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      R.cam.r = clamp(R.cam.r*pinch.d/Math.max(d, 1), 6, 300); pinch.d = d;
      const mx = (a.x + b.x)/2, my = (a.y + b.y)/2; panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
      if(drag) drag.moved += 99; R.tween = null; clearViews(); return;
    }
    if(!drag) return;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if(drag.moved < 4) return;
    R.tween = null; clearViews();
    if(drag.pan) panBy(dx, dy);
    else { R.cam.th -= dx*0.0065; R.cam.ph = clamp(R.cam.ph - dy*0.005, 0.05, 1.52); }
    st.classList.add('drag');
  });
  const end = e => {
    if(!ptrs.has(e.pointerId)) return;
    const tap = drag && drag.moved < 7 && ptrs.size === 1 && e.type === 'pointerup';
    ptrs.delete(e.pointerId);
    if(ptrs.size < 2) pinch = null;
    if(ptrs.size === 0){ drag = null; st.classList.remove('drag'); }
    if(tap){ const hit = pickAt(e.clientX, e.clientY); select(hit ? hit.key : null, hit && hit.f); }
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  st.addEventListener('pointerleave', () => { R.tip.style.display = 'none'; });
  st.addEventListener('wheel', e => {
    if(!(e.ctrlKey || e.metaKey)){ nudgeHint(); return; }
    e.preventDefault(); R.tween = null; interacted();
    R.cam.r = clamp(R.cam.r*(1 + e.deltaY*0.0022), 6, 300);
  }, {passive:false});
  HOST.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => {
    interacted();
    R.tween = {from:Object.assign({}, R.cam), to:Object.assign({}, R.cam, {r:clamp(R.cam.r*(b.dataset.z === 'in' ? 0.74 : 1.35), 6, 300)}), t0:performance.now(), dur:360};
  }));
  HOST.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { interacted(); setBase(b.dataset.b); }));
}
function bindPanel(){
  HOST.querySelector('#tw-eras').innerHTML = ERAS.map((e, i) =>
    `<button class="tw-e" role="tab" data-i="${i}" style="--ec:${CONF_VAR[e.c]}" title="${e.t}">${ic(ERA_ICON[i])}<span class="ey">${e.y}</span><span class="et">${e.t}</span></button>`).join('');
  HOST.querySelector('#tw-eras').addEventListener('click', ev => { const b = ev.target.closest('.tw-e'); if(b){ stopPlay(); setEra(+b.dataset.i); } });
  HOST.querySelector('#tw-play').addEventListener('click', play);
  HOST.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { interacted(); goView(b.dataset.v); }));
  HOST.querySelector('#tw-layers').addEventListener('click', e => {
    const b = e.target.closest('[data-l]'); if(!b || b.disabled) return;
    const k = b.dataset.l; S[k] = !S[k]; b.setAttribute('aria-pressed', String(S[k]));
    if(k === 'labels') return;
    S.floodK = effFlood(); retarget(); renderSection(); hud();
    if(SEL) showInfo(SEL.key);
  });
  R.range.addEventListener('input', () => { SECX = +R.range.value; renderSection(); });
  R.svg.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'); if(!t) return;
    const key = t.getAttribute('data-k');
    select(key, F.find(f => f.key === key && f.to === 1) || null);
  });
  HOST.addEventListener('keydown', e => {
    if(e.target.closest('input, textarea')) return;
    if(e.key === 'ArrowRight'){ stopPlay(); setEra(ERA + 1); e.preventDefault(); }
    if(e.key === 'ArrowLeft'){ stopPlay(); setEra(ERA - 1); e.preventDefault(); }
  });
}
function play(){
  if(PLAY){ stopPlay(); return; }
  R.playBtn.innerHTML = `${ic('pause')}<span>Pause</span>`;
  setEra(ERA >= ERAS.length - 1 ? 0 : ERA + 1);
  PLAY = setInterval(() => { if(ERA >= ERAS.length - 1) stopPlay(); else setEra(ERA + 1); }, 4600);
}
function stopPlay(){ if(PLAY){ clearInterval(PLAY); PLAY = null; } if(R && R.playBtn) R.playBtn.innerHTML = `${ic('play')}<span>Play</span>`; }

function frame(now){
  requestAnimationFrame(frame);
  if(!R.visible || document.hidden){ R.last = now; return; }
  const dt = Math.min(0.05, (now - (R.last || now))/1000); R.last = now; R.time += dt;
  stepTween(now); applyCam(); stepMorph(now);
  rippleWater(R.time); stepParticles(dt); pulses(R.time);
  R.renderer.render(R.scene, R.camera);
  placeLabels();
}
function resize(){
  const w = Math.max(1, R.stage.clientWidth), h = Math.max(1, R.stage.clientHeight);
  R.w = w; R.h = h;
  if(!R.gl) return;
  R.renderer.setSize(w, h, false); R.camera.aspect = w/h; R.camera.updateProjectionMatrix();
  const tall = w/h < 0.9;
  if(R.lastTall !== undefined && tall !== R.lastTall){ R.lastTall = tall; if(R.viewName) goView(R.viewName, true); }
}

function init(host){
  HOST = host; if(!host) return;
  host.innerHTML = `<div class="tw">${shell()}</div>`;
  RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  ERA = NOW_ERA();
  const stage = host.querySelector('#tw-stage');
  R = {gl:false, stage, info:host.querySelector('#tw-info'), svg:host.querySelector('#tw-svg'), at:host.querySelector('#tw-at'),
       hud:host.querySelector('#tw-hud'), tip:host.querySelector('#tw-tip'), hint:host.querySelector('#tw-hint'), attr:host.querySelector('#tw-attr'),
       labs:host.querySelector('#tw-labs'), range:host.querySelector('#tw-x'), playBtn:host.querySelector('#tw-play'),
       canvas:stage.querySelector('canvas'), visible:true, time:0, labF:[], base:null, baseFail:null, viewName:'down'};
  bindPanel();
  let why = null;
  if(typeof THREE === 'undefined') why = 'The 3D view needs an internet connection to load. The timeline and cross-section still work.';
  else {
    try{
      const renderer = new THREE.WebGLRenderer({canvas:R.canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xE3E6E1, 260, 620);
      const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 1200);
      scene.add(new THREE.HemisphereLight(0xDCE6EE, 0x7D7669, 0.55));
      const sun = new THREE.DirectionalLight(0xFFF1DC, 0.72);
      const mid = W(60, 0, 0); sun.position.set(mid[0] + 70, 120, mid[2] + 50); sun.target.position.set(mid[0], 0, mid[2]);
      sun.castShadow = true; sun.shadow.mapSize.set(Math.min(4096, renderer.capabilities.maxTextureSize), Math.min(4096, renderer.capabilities.maxTextureSize));
      Object.assign(sun.shadow.camera, {left:-80, right:80, top:80, bottom:-80, near:20, far:320}); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      scene.add(sun); scene.add(sun.target);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const fill = new THREE.DirectionalLight(0xCFDCE8, 0.16); fill.position.set(-60, 40, -80); scene.add(fill);
      const c0 = W(X0, Z0, 0), c1 = W(X1, Z1, 0), c2 = W(X0, Z1, 0), c3 = W(X1, Z0, 0);
      Object.assign(R, {gl:true, renderer, scene, camera, pick:[], pickF:[], ray:new THREE.Raycaster(),
        cam:{tx:0, ty:0, tz:0, r:200, th:0.62, ph:1.0}, tween:null,
        bb:{x0:Math.min(c0[0], c1[0], c2[0], c3[0]), x1:Math.max(c0[0], c1[0], c2[0], c3[0]), z0:Math.min(c0[2], c1[2], c2[2], c3[2]), z1:Math.max(c0[2], c1[2], c2[2], c3[2])},
        wc0:new THREE.Color(), wc1:new THREE.Color(), silt:new THREE.Color(0x7A6A45), wo0:0, wo1:0});
      buildTerrain(); buildSkirts(); buildWater(); buildCaps(); buildParticles(); buildSection(); buildFeatures(); buildLabels();
      bindControls();
      resize();
      R.lastTall = R.w/R.h < 0.9;
      if(typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage);
      else window.addEventListener('resize', resize);
      if(typeof IntersectionObserver !== 'undefined') new IntersectionObserver(es => es.forEach(en => { R.visible = en.isIntersecting; }), {rootMargin:'120px'}).observe(stage);
      goView('down', true);
    }catch(err){ why = 'This device could not start the 3D view. The timeline and cross-section still work.'; console.warn(err); R.gl = false; }
  }
  if(why){ stage.classList.add('flat'); host.querySelector('.tw').classList.add('flat'); stage.insertAdjacentHTML('beforeend', `<div class="tw-fallback">${why}</div>`); }
  setEra(ERA, true);
  if(R.gl){
    requestAnimationFrame(frame); setBase(S.base);
    fetchCity().then(city => { buildCity(city); R.citySrc = city.src || 'file'; retarget(); hud(); }).catch(err => { console.warn('city data unavailable', err); R.cityFail = true; hud(); });
  }
}
function onLive(){
  if(!R) return;
  if(ERA === 6){ S.floodK = effFlood(); retarget(); renderSection(); }
  hud();
  if(SEL && (SEL.key === 'gauge' || SEL.key === 'water')) showInfo(SEL.key);
}
/* jump to a feature: pick an era where it exists, fly there, select it */
function flyTo(key){
  const cands = F.filter(f => f.key === key && f.anchor);
  if(!cands.length){ select(key, null); return; }
  const here = cands.find(f => wantOn(f, ERA)) || cands.find(f => f.range[0] <= NOW_ERA() && f.range[1] >= NOW_ERA()) || cands[0];
  if(!wantOn(here, ERA)){ stopPlay(); setEra(clamp(NOW_ERA(), here.range[0], here.range[1]), false); }
  const f = F.find(x => x.key === key && x.anchor && wantOn(x, ERA)) || here;
  select(key, f, true);
  if(R.gl){
    const p = Wr(f.anchor[0], f.anchor[1], 0);
    clearViews();
    R.tween = {from:Object.assign({}, R.cam), to:{tx:p[0], ty:p[1], tz:p[2], r:Math.min(R.cam.r, 34), th:R.cam.th, ph:Math.min(R.cam.ph, 0.95)}, t0:performance.now(), dur:900};
  }
  if(HOST) HOST.scrollIntoView({behavior:RM ? 'auto' : 'smooth', block:'start'});
}

return {
  init, onLive, flyTo,
  setEra: i => { stopPlay(); setEra(i); },
  view: v => goView(v),
  select: k => select(k, F.find(f => f.key === k && f.to === 1) || null),
  layer: (k, v) => { S[k] = !!v; const b = HOST.querySelector(`[data-l="${k}"]`); if(b) b.setAttribute('aria-pressed', String(S[k])); S.floodK = effFlood(); retarget(); renderSection(); hud(); },
  base: k => setBase(k),
  city: d => { if(R && R.gl && !(R.city && R.city.on)){ buildCity(d); R.citySrc = d.src || 'given'; retarget(); hud(); } },
  get era(){ return ERA; },
  eras: ERAS, info: INFO, landmarks: LANDMARKS, crossings: XINGS, basemaps: BASEMAPS
};
})();

/* ============================================================================
   RIVER LIFE
   A 3D scene of what lives in the downtown river, keyed to the month. Every
   animal is built from primitives, so nothing loads and nothing is copied.
   Seasonal timing follows the DNR and the research base; it is typical timing,
   not an observation. Photos come from Wikipedia at view time.
   ========================================================================= */
const Life = (() => {

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOW = () => new Date().getMonth();
/* presence by month: 0 not in the downtown river, 1 present, 2 active or peak */
const yr = (...pairs) => { const m = new Array(12).fill(1); for(let i = 0; i < pairs.length; i += 2) for(const k of pairs[i]) m[k] = pairs[i + 1]; return m; };
const SEASON = {
  'Chinook salmon':{size:'Up to 3 ft, 15 to 30 lb', m:[0,0,0,0,0,0,0,1,2,2,1,0], off:'Not in the downtown river. Out in Lake Michigan, feeding.',
    ph:[[[7],'First kings enter from Lake Michigan as the water cools into the 60s. Look below Sixth Street Dam.'],[[8,9],'Peak run. Fish stack below the dam and climb the ladder. Spawning colours darken, jaws hook.'],[[10],'Last of the spawners, then they die. Eagles and gulls work the carcasses.']]},
  'Coho salmon':{size:'20 to 30 in, 6 to 12 lb', m:[0,0,0,0,0,0,0,1,2,2,1,0], off:'Not in the downtown river until late summer.',
    ph:[[[7],'First coho arrive a few weeks behind the kings.'],[[8],'Peak run in mid to late September.'],[[9],'Run winds down. Bright fish turn dark red for spawning.'],[[10],'Stragglers only.']]},
  'Steelhead':{size:'24 to 32 in, 6 to 12 lb', m:[1,2,2,2,1,0,0,0,1,1,2,1], off:'Mostly back in the lake for summer. A few summer-run Skamania linger.',
    ph:[[[8,9],'Fall run begins late September, early October, behind the salmon.'],[[10],'Peak of the fall run below Sixth Street.'],[[11,0],'Winter holdovers sit in the deep pools, often under ice.'],[[1,2,3],'Spring spawning push, the biggest of the year. Early March is the peak. Fish on gravel.'],[[4],'Spawned-out fish drop back to the lake.']]},
  'Lake sturgeon':{size:'4 to 6 ft, can live a century', m:yr([4,5],2), off:'',
    ph:[[[3,4,5],'Spawning season. Adults move onto rock and gravel when the water reaches the mid 50s F. Never target them.'],[[6,7],'Summer feeding in the deep pools, vacuuming the bottom.'],[[8,9],'Juveniles show up in fall surveys. Six were tagged in 2022, proof the river breeds its own.'],[[10,11,0,1,2],'Slow in cold water, holding deep.']]},
  'River redhorse':{size:'18 to 30 in', m:yr([4,5],2), off:'',
    ph:[[[4,5],'Spawning on gravel bars in late May and early June.'],[[6,7,8],'Feeding on snails and small mussels over rock, which is why the new riffles matter.'],[[9,10,11,0,1,2,3],'Holding in runs and pools.']]},
  'Walleye':{size:'15 to 25 in', m:yr([2,3],2,[9,10],2), off:'',
    ph:[[[2,3],'Spring run stacks below Sixth Street Dam. Spawning on rock at 42 to 50 F.'],[[4],'Post spawn and scattered.'],[[5,6,7],'Deep runs by day, feeding along edges at night.'],[[8,9,10],'Fall movement toward the dam. Good fishing.'],[[11,0,1],'Slow and deep through winter.']]},
  'Smallmouth bass':{size:'12 to 20 in', m:yr([4,5,6,7],2,[10,11,0,1,2],1), off:'',
    ph:[[[4,5],'Spawning in the shallows once the water passes about 60 F. The new boulders are nest cover.'],[[6,7],'Prime summer fishing on rock and current breaks.'],[[8,9],'Feeding hard before winter.'],[[10,11,0,1,2,3],'Wintering in deep, slow water.']]},
  'Largemouth bass':{size:'12 to 20 in', m:yr([5,6,7],2), off:'',
    ph:[[[5,6,7],'Summer in the slow margins and backwaters, stronger downstream of the city.'],[[8,9,10,11,0,1,2,3,4],'Present but scattered. Slow water, weed edges.']]},
  'Northern pike':{size:'24 to 40 in', m:yr([2,3],2), off:'',
    ph:[[[2,3],'Spawning in flooded vegetation right after ice out.'],[[4,5,6,7,8],'Ambush hunter in weed beds and slack water, mostly in the wider river below town.'],[[9,10,11,0,1],'Slow, deep, still hunting.']]},
  'Channel catfish':{size:'15 to 25 in', m:yr([4,5,6,7],2), off:'',
    ph:[[[4],'Waking up as the water warms. Feeding at night.'],[[5,6],'Spawning in cavities and under ledges, then hard feeding.'],[[7,8],'Summer nights in the deeper, slower runs. Anglers below the dam catch them.'],[[9,10,11,0,1,2,3],'Dormant in cold water.']]},
  'Flathead catfish':{size:'25 to 45 in, 20 to 50 lb', m:yr([5,6,7],2), off:'',
    ph:[[[5,6,7],'Summer nights. Big fish hunt live prey in pools and under cover.'],[[8,9],'Feeding before winter.'],[[10,11,0,1,2,3,4],'Wintering in the deepest pools, barely moving.']]},
  'White sucker':{size:'12 to 20 in', m:yr([3],2,[4],1), off:'',
    ph:[[[3],'Spring run over gravel, an unglamorous migration that feeds everything.'],[[4],'Spawned out, dropping back.'],[[5,6,7,8,9,10,11,0,1,2],'Bottom feeding in runs and pools.']]},
  'Gizzard shad':{size:'8 to 14 in', m:yr([5],2), off:'',
    ph:[[[5],'Spawning in the shallows.'],[[6,7,8,9],'Big schools, the forage fish that feeds walleye, bass and birds.'],[[0,1],'Die-offs after sharp cold snaps. Gulls and eagles clean up.'],[[2,3,4,10,11],'Schooling in slower water.']]},
  'Pugnose shiner':{size:'About 2 in', m:yr([5],2), off:'',
    ph:[[[5],'Spawning in aquatic vegetation.'],[[0,1,2,3,4,6,7,8,9,10,11],'Needs clear water and healthy plants. State endangered, rarely seen.']]},
  'Spotted gar':{size:'2 to 3 ft', m:yr([5,6,7],2), off:'',
    ph:[[[4,5],'Spawning in quiet backwaters and bayous.'],[[6,7],'Basking near the surface in slack water. Juveniles documented in a lower-river bayou.'],[[8,9,10,11,0,1,2,3],'Slow, deep, mostly below the city.']]},
  'Snuffbox mussel':{size:'1.5 to 2.5 in shell', m:yr([4,5,6],2), off:'',
    ph:[[[4,5,6],'Females lure logperch, clamp onto their heads and release larvae onto their gills.'],[[7,8],'Relocation season. 38 were moved out of the Lower Reach in 2024.'],[[9,10,11,0,1,2,3],'Buried in gravel, filtering.']]},
  'Purple wartyback':{size:'3 to 4 in shell', m:yr([5,6],2), off:'',
    ph:[[[5,6],'Spawning. Larvae ride on catfish.'],[[7],'Among about 3,000 mussels moved below Knapp Street in July 2026.'],[[8,9,10,11,0,1,2,3,4],'Filtering in the gravel.']]},
  'Freshwater mussels':{size:'2 to 6 in', m:yr([6,7],2), off:'',
    ph:[[[6,7],'Relocation season. Warm water, low flow, divers hand picking the bed ahead of the excavators.'],[[0,1,2,3,4,5,8,9,10,11],'Filtering bacteria, algae and sediment. They cannot move out of the way.']]},
  'Bald eagle':{size:'6 to 7.5 ft wingspan', m:yr([11,0,1],2,[2],2), off:'',
    ph:[[[11,0,1],'Winter concentration wherever the water stays open. The dam tailwater is a feeding spot.'],[[2],'Nesting begins. Eggs in the big stick nests along the corridor.'],[[3,4,5],'Chicks in the nest, adults fishing the shallows.'],[[6,7],'Fledglings learning to fish.'],[[8,9,10],'Fewer birds, then the salmon carcasses bring them back.']]},
  'Great blue heron':{size:'4 ft tall, 6 ft wingspan', m:yr([3,4,5,6,7,8],2,[11,0,1],1), off:'',
    ph:[[[2],'First birds back at the colonies.'],[[3,4,5,6,7,8],'Wading the shallows and slow edges at dawn and dusk. The riffle margins will be prime.'],[[9,10],'Most leave as the shallows cool.'],[[11,0,1],'A few stay where the water stays open.']]},
  'North American river otter':{size:'3 to 4 ft nose to tail', m:yr([1,2],2), off:'',
    ph:[[[1,2],'Mating season, most visible on ice edges and open water.'],[[3,4],'Pups in a bank den.'],[[5,6,7,8,9,10,11,0],'Plausible in the wider system. Downtown sightings should be observation based.']]},
  'American mink':{size:'18 to 24 in', m:yr([3,4],2), off:'',
    ph:[[[3,4],'Kits in a bank den. Adults hunting hard along the edge.'],[[5,6,7,8,9,10,11,0,1,2],'Bank hunter, mostly at night. Tracks in mud and snow give it away.']]},
  'North American beaver':{size:'3 to 4 ft, 40 to 60 lb', m:yr([9,10],2,[4],2), off:'',
    ph:[[[4],'Kits born in the lodge or bank burrow.'],[[9,10],'Cutting trees and caching branches for winter. Most visible at dusk.'],[[11,0,1,2,3,5,6,7,8],'Corridor resident, shaping bank vegetation.']]},
  'Muskrat':{size:'18 to 25 in with tail', m:yr([2,3],2), off:'',
    ph:[[[2,3],'Spring dispersal and breeding. Young animals show up everywhere.'],[[4,5,6,7,8,9,10,11,0,1],'Common in slower vegetated water. A small V wake at dusk.']]},
  'Spiny softshell turtle':{size:'Shell to 18 in on females', m:yr([4,5,6,7],2,[10,11,0,1,2],1), off:'',
    ph:[[[3],'Emerging from the mud.'],[[4],'Basking on sandbars and logs.'],[[5],'Nesting on soft sandy banks, which the hard floodwall edge does not provide.'],[[6,7,8],'Basking and hunting in the shallows.'],[[9],'Slowing down.'],[[10,11,0,1,2],'Hibernating buried in the bottom.']]},
  'Northern map turtle':{size:'Shell 4 to 10 in', m:yr([4,5,6,7],2,[10,11,0,1,2],1), off:'',
    ph:[[[3],'First basking days.'],[[4],'Basking stacked on logs and rock in the main channel.'],[[5],'Nesting in sand and gravel.'],[[6,7,8],'Basking, eating snails and mussels.'],[[9],'Last basking before winter.'],[[10,11,0,1,2],'Overwintering on the bottom.']]},
  'Mudpuppy':{size:'8 to 13 in', m:yr([10,11,0,1,2],2), off:'',
    ph:[[[10,11,0,1,2],'Most active in cold water. Anglers catch them through the ice.'],[[3,4],'Eggs laid under rocks. Host for the salamander mussel.'],[[5,6,7,8,9],'Hiding under rocks by day.']]},
  'Sea lamprey':{size:'12 to 24 in', m:[0,0,0,1,2,2,1,0,0,0,0,0], off:'Adults are out in the lake, parasitising trout and salmon. Larvae live in stream beds for years.',
    ph:[[[3],'First adults arrive from the lake.'],[[4,5],'Spawning run. They climb as far as Sixth Street Dam and stop. That is the wall.'],[[6],'Spawned adults die.']]},
  'Round goby':{size:'4 to 6 in', m:yr([4,5,6,7],2), off:'',
    ph:[[[4,5,6,7],'Spawning repeatedly through summer. Eats eggs and young of native fish.'],[[8,9,10,11,0,1,2,3],'On the bottom among rock, year round.']]},
  'Zebra mussel':{size:'Under 1.5 in', m:yr([5,6,7],2), off:'',
    ph:[[[5,6,7],'Spawning once the water passes about 54 F. Larvae drift.'],[[8,9,10,11,0,1,2,3,4],'Encrusting rock and native mussels. Not a native unionid.']]},
  'Common carp':{size:'20 to 30 in, can top 30 lb', m:yr([4,5],2), off:'',
    ph:[[[4,5],'Spawning in flooded shallows, thrashing at the surface.'],[[6,7,8],'Rooting in soft sediment, muddying the water.'],[[9,10,11,0,1,2,3],'Schooled in deeper, slower water.']]},
  'Eurasian watermilfoil':{size:'Stems to 10 ft', m:[0,0,0,0,1,2,2,2,2,1,0,0], off:'Dies back to root crowns for winter.',
    ph:[[[4],'Growing fast from the bottom.'],[[5,6,7,8],'Dense mats in slow water. Fragments spread it.'],[[9],'Dying back.']]},
  'Purple loosestrife':{size:'3 to 6 ft', m:[0,0,0,0,0,1,2,2,1,0,0,0], off:'Dead stalks and seed through winter.',
    ph:[[[5],'Green growth on wet banks.'],[[6,7],'Purple spikes in bloom, one plant setting a million seeds.'],[[8],'Going to seed.']]},
  'Phragmites':{size:'6 to 15 ft', m:[1,1,1,1,1,1,2,2,2,1,1,1], off:'',
    ph:[[[6,7,8],'Full height with feathery plumes. Crowding out native cattail and sedge.'],[[9,10],'Turning tan.'],[[11,0,1,2,3,4,5],'Dead stalks stand all winter, then new shoots in May.']]}
};
/* how each animal is built */
const MODELS = {
  'Chinook salmon':{kind:'fish', body:'salmon', len:0.95, h:1, w:0.55, tail:'fork', dorsal:'short', top:0x2E4A3B, side:0x8BA08A, belly:0xD9D6C6, pattern:'spots', n:3, depth:-1.3, speed:0.9, view:'under'},
  'Coho salmon':{kind:'fish', body:'salmon', len:0.7, h:1, w:0.52, tail:'fork', dorsal:'short', top:0x3A4E3F, side:0xA6B39B, belly:0xE2DFCF, pattern:'spots', n:3, depth:-1.3, speed:1.0, view:'under'},
  'Steelhead':{kind:'fish', body:'salmon', len:0.75, h:0.95, w:0.5, tail:'fork', dorsal:'short', top:0x3C5060, side:0xC4CDD0, belly:0xEDEDE6, pattern:'stripe', n:2, depth:-1.2, speed:1.1, view:'under'},
  'Lake sturgeon':{kind:'fish', body:'sturgeon', len:1.7, h:0.8, w:0.85, tail:'hetero', dorsal:'back', top:0x4F4A3E, side:0x8B8270, belly:0xD8D0BC, pattern:'scutes', n:1, depth:-2.1, speed:0.45, view:'under'},
  'River redhorse':{kind:'fish', body:'sucker', len:0.6, h:1, w:0.6, tail:'fork', dorsal:'short', top:0x6F7B4E, side:0xC3B27A, belly:0xE9E0C2, pattern:'none', fin:0xB8442E, n:2, depth:-2.0, speed:0.7, view:'under'},
  'Walleye':{kind:'fish', body:'walleye', len:0.55, h:1, w:0.55, tail:'fork', dorsal:'spiny', top:0x5C5A2F, side:0xC9B76B, belly:0xEEE7C8, pattern:'bars', n:2, depth:-1.7, speed:0.8, view:'under'},
  'Smallmouth bass':{kind:'fish', body:'bass', len:0.42, h:1.1, w:0.5, tail:'round', dorsal:'spiny', top:0x5B5A32, side:0xA98F4E, belly:0xE6DEB9, pattern:'bars', n:2, depth:-1.4, speed:0.9, view:'under'},
  'Largemouth bass':{kind:'fish', body:'bass', len:0.45, h:1.1, w:0.5, tail:'round', dorsal:'spiny', top:0x3D5A2E, side:0x8FA65B, belly:0xE7E8CC, pattern:'stripe-dark', n:1, depth:-1.3, speed:0.7, view:'under'},
  'Northern pike':{kind:'fish', body:'pike', len:0.9, h:0.8, w:0.55, tail:'round', dorsal:'back', top:0x3F5A2E, side:0x7E9A4E, belly:0xE8E6C3, pattern:'spots-light', n:1, depth:-1.2, speed:0.35, view:'under'},
  'Channel catfish':{kind:'fish', body:'catfish', len:0.55, h:0.95, w:0.7, tail:'fork', dorsal:'short', top:0x55606A, side:0x98A0A0, belly:0xE4E3D8, pattern:'none', barbels:true, n:2, depth:-2.1, speed:0.6, view:'under'},
  'Flathead catfish':{kind:'fish', body:'catfish', len:0.95, h:0.9, w:0.8, tail:'round', dorsal:'short', top:0x5C5A3A, side:0xA69C5E, belly:0xE8E0B8, pattern:'mottle', barbels:true, n:1, depth:-2.2, speed:0.4, view:'under'},
  'White sucker':{kind:'fish', body:'sucker', len:0.45, h:1, w:0.6, tail:'fork', dorsal:'short', top:0x6E6A55, side:0xB9AE8E, belly:0xEDE9DA, pattern:'none', n:3, depth:-2.0, speed:0.7, view:'under'},
  'Gizzard shad':{kind:'fish', body:'shad', len:0.28, h:1.2, w:0.35, tail:'fork', dorsal:'short', top:0x5A6E7A, side:0xC9D3D6, belly:0xF2F2EE, pattern:'none', n:12, depth:-1.1, speed:1.2, view:'under'},
  'Pugnose shiner':{kind:'fish', body:'shad', len:0.06, h:1, w:0.4, tail:'fork', dorsal:'short', top:0x8A9A7A, side:0xD8DEC8, belly:0xF3F3EA, pattern:'stripe-dark', n:14, depth:-0.6, speed:1.4, view:'shallow'},
  'Spotted gar':{kind:'fish', body:'gar', len:0.75, h:0.75, w:0.7, tail:'round', dorsal:'back', top:0x4E5A33, side:0x9AA86A, belly:0xE4E3C4, pattern:'spots', n:1, depth:-0.6, speed:0.3, view:'under'},
  'Snuffbox mussel':{kind:'mussel', size:0.06, col:0x6B5B3E, n:5, view:'bed'},
  'Purple wartyback':{kind:'mussel', size:0.09, col:0x5A4634, n:4, warty:true, view:'bed'},
  'Freshwater mussels':{kind:'mussel', size:0.1, col:0x4D4635, n:8, view:'bed'},
  'Bald eagle':{kind:'eagle', view:'sky'},
  'Great blue heron':{kind:'heron', view:'edge'},
  'North American river otter':{kind:'otter', view:'surface'},
  'American mink':{kind:'mink', view:'bank'},
  'North American beaver':{kind:'beaver', view:'surface'},
  'Muskrat':{kind:'muskrat', view:'surface'},
  'Spiny softshell turtle':{kind:'turtle', flat:true, size:0.36, col:0x8A8A5A, view:'log'},
  'Northern map turtle':{kind:'turtle', flat:false, size:0.22, col:0x4E5A3F, view:'log'},
  'Mudpuppy':{kind:'mudpuppy', view:'bed'},
  'Sea lamprey':{kind:'fish', body:'eel', len:0.5, h:1, w:1, tail:'eel', dorsal:'none', top:0x4A4238, side:0x7C7264, belly:0xB9AE99, pattern:'mottle', n:2, depth:-1.9, speed:0.8, view:'under'},
  'Round goby':{kind:'fish', body:'goby', len:0.13, h:1.1, w:0.9, tail:'round', dorsal:'spiny', top:0x5E5A48, side:0x9C9478, belly:0xD8D2BD, pattern:'mottle', n:4, depth:-2.35, speed:0.5, bottom:true, view:'bed'},
  'Zebra mussel':{kind:'mussel', size:0.025, col:0xC9B99A, n:40, striped:true, view:'bed'},
  'Common carp':{kind:'fish', body:'sucker', len:0.7, h:1.15, w:0.65, tail:'fork', dorsal:'long', top:0x6F5A2E, side:0xC79A45, belly:0xEED9A2, pattern:'scales', barbels:true, n:2, depth:-1.6, speed:0.55, view:'under'},
  'Eurasian watermilfoil':{kind:'plant', style:'milfoil', view:'shallow'},
  'Purple loosestrife':{kind:'plant', style:'loosestrife', view:'bank'},
  'Phragmites':{kind:'plant', style:'reed', view:'bank'}
};
const GROUP_ICON = {fish:'fish', mussel:'shell', wild:'paw', inv:'bug'};
/* painted illustrations in art/, cut out on transparent backgrounds. w and h are the image proportions, v is the viewpoint */
const ART = {"Chinook salmon":{"s":"chinook","w":1.0,"h":0.449,"v":"side"},"Coho salmon":{"s":"coho","w":1.0,"h":0.44,"v":"side"},"Steelhead":{"s":"steelhead","w":1.0,"h":0.447,"v":"side"},"Lake sturgeon":{"s":"sturgeon","w":1.0,"h":0.347,"v":"side"},"River redhorse":{"s":"redhorse","w":1.0,"h":0.543,"v":"side"},"Walleye":{"s":"walleye","w":1.0,"h":0.474,"v":"side"},"Smallmouth bass":{"s":"smallmouth","w":1.0,"h":0.472,"v":"side"},"Largemouth bass":{"s":"largemouth","w":1.0,"h":0.485,"v":"side"},"Northern pike":{"s":"pike","w":1.0,"h":0.323,"v":"side"},"Channel catfish":{"s":"channel-catfish","w":1.0,"h":0.421,"v":"side"},"Flathead catfish":{"s":"flathead-catfish","w":1.0,"h":0.397,"v":"side"},"White sucker":{"s":"white-sucker","w":1.0,"h":0.448,"v":"side"},"Gizzard shad":{"s":"gizzard-shad","w":1.0,"h":0.553,"v":"side"},"Pugnose shiner":{"s":"pugnose-shiner","w":1.0,"h":0.436,"v":"side"},"Spotted gar":{"s":"spotted-gar","w":1.0,"h":0.281,"v":"side"},"Freshwater mussels":{"s":"mussel","w":1.0,"h":0.606,"v":"oblique"},"Spiny softshell turtle":{"s":"softshell","w":1.0,"h":0.72,"v":"top"},"Northern map turtle":{"s":"map-turtle","w":1.0,"h":0.904,"v":"top"},"Mudpuppy":{"s":"mudpuppy","w":1.0,"h":0.582,"v":"top"},"Sea lamprey":{"s":"lamprey","w":1.0,"h":0.789,"v":"side"},"Round goby":{"s":"goby","w":1.0,"h":0.54,"v":"side"},"Zebra mussel":{"s":"zebra-mussel","w":1.0,"h":0.661,"v":"oblique"},"Common carp":{"s":"carp","w":1.0,"h":0.598,"v":"side"},"Eurasian watermilfoil":{"s":"milfoil","w":0.841,"h":1.0,"v":"upright"}};
const ART_BASE = 'art/';
const artUrl = (slug, t) => (typeof window !== 'undefined' && window.ART_INLINE && window.ART_INLINE[slug + (t ? '-t' : '')]) || (ART_BASE + slug + (t ? '-t' : '') + '.webp');
const TEX = {};
function artTex(slug){
  if(!TEX[slug]){ const tex = new THREE.TextureLoader().load(artUrl(slug)); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; TEX[slug] = tex; }
  return TEX[slug];
}
/* a painted animal as a cut-out that swims, lies on the bed, or stands on it */
function cutout(name, P, seed){
  const A = ART[name], tex = artTex(A.s);
  let L = P.kind === 'fish' ? P.len : P.kind === 'turtle' ? P.size*2.6 : P.kind === 'mussel' ? Math.max(0.16, P.size*3) : P.kind === 'mudpuppy' ? 0.55 : 1.4;
  if(A.v === 'upright'){ const Hh = 2.2; L = Hh*A.w/A.h; }
  const Hh = L*A.h/A.w;
  const geo = new THREE.PlaneGeometry(L, Hh, 40, 8);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide, alphaTest:0.06, depthWrite:true, color:0xF6F6F2})); mesh.renderOrder = 1;
  const g = new THREE.Group(); g.add(mesh); g.userData.cut = true;
  if(A.v === 'side'){
    const pos = geo.attributes.position.array, base = new Float32Array(pos), t = new Float32Array(geo.attributes.position.count);
    for(let i = 0; i < t.length; i++) t[i] = clamp(0.5 - base[i*3]/L, 0, 1);
    mesh.userData.anim = {base, t, L, amp:(P.body === 'eel' ? 0.13 : P.body === 'sturgeon' || P.body === 'pike' || P.body === 'gar' ? 0.035 : 0.055)*L, freq:5.2/Math.max(0.35, Math.sqrt(L)), k:(P.body === 'eel' ? 7 : 3.2), phase:seed*7};
  } else if(A.v === 'top'){ mesh.rotation.x = -Math.PI/2 + 0.8; mesh.rotation.z = -0.5; }
  else if(A.v === 'oblique'){ mesh.rotation.x = -Math.PI/2 + 0.5; mesh.rotation.z = hash(seed, 4)*0.8 - 0.4; }
  else if(A.v === 'upright'){ mesh.position.y = Hh/2; }
  return g;
}

/* ---------- geometry helpers ---------- */
let R = null, HOST = null, CUR = null, FILTER = 'all';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a)*t;
const hash = (a, b) => { const s = Math.sin(a*127.1 + b*311.7)*43758.5453; return s - Math.floor(s); };
const col3 = h => new THREE.Color(h);
function mat(color, o){ return new THREE.MeshStandardMaterial(Object.assign({color, roughness:.7, metalness:0}, o || {})); }
const VMAT = () => new THREE.MeshStandardMaterial({vertexColors:true, roughness:.55, metalness:.05, side:THREE.DoubleSide});

function profile(body, t){
  let r;
  switch(body){
    case 'pike': r = Math.sin(Math.PI*Math.pow(t, 0.75))*0.55 + 0.06; if(t < 0.22) r *= 0.4 + t/0.22*0.6; break;
    case 'sturgeon': r = t < 0.15 ? 0.25 + t/0.15*0.5 : 0.75*Math.pow(1 - (t - 0.15)/0.85, 0.75); break;
    case 'catfish': r = t < 0.22 ? 0.68 + t*0.4 : 0.77*Math.pow(1 - (t - 0.22)/0.78, 0.85); break;
    case 'gar': r = t < 0.3 ? 0.1 + t/0.3*0.32 : 0.42*Math.pow(1 - (t - 0.3)/0.7, 0.65); break;
    case 'eel': r = 0.2*Math.pow(Math.sin(Math.PI*t), 0.35); break;
    case 'bass': r = Math.sin(Math.PI*Math.pow(t, 0.9))*0.92; break;
    case 'shad': r = Math.sin(Math.PI*Math.pow(t, 0.95))*0.9; break;
    case 'goby': r = t < 0.3 ? 0.7 + t*0.5 : 0.85*Math.pow(1 - (t - 0.3)/0.7, 0.9); break;
    case 'sucker': r = Math.sin(Math.PI*Math.pow(t, 0.8))*0.78; break;
    case 'walleye': r = Math.sin(Math.PI*Math.pow(t, 0.8))*0.68; break;
    default: r = Math.sin(Math.PI*Math.pow(t, 0.85))*0.72;
  }
  return Math.max(0.03, r);
}
function shapeGeo(pts){ const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return new THREE.ShapeGeometry(s); }
function tint(geo, fn){
  const p = geo.attributes.position, n = p.count, c = new Float32Array(n*3), v = new THREE.Vector3(), cc = new THREE.Color();
  for(let i = 0; i < n; i++){ v.fromBufferAttribute(p, i); fn(v, cc, i); c[i*3] = cc.r; c[i*3 + 1] = cc.g; c[i*3 + 2] = cc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
function merge(list){
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n*3), col = new Float32Array(n*3), nor = new Float32Array(n*3);
  let o = 0;
  for(const g of parts){
    if(!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o*3); col.set(g.attributes.color.array, o*3); nor.set(g.attributes.normal.array, o*3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
/* a fish, head toward +x, built from a lathe body and flat fins, coloured per vertex */
function fishMesh(P, seed){
  const L = P.len, H = P.h*0.22*L, Wd = P.w*0.22*L;
  const top = col3(P.top), side = col3(P.side), belly = col3(P.belly), finC = col3(P.fin || P.top).lerp(col3(P.side), 0.35);
  const pts = [];
  for(let i = 0; i <= 28; i++){ const t = i/28; pts.push(new THREE.Vector2(profile(P.body, t)*H + (i === 0 || i === 28 ? 0.001 : 0), (0.5 - t)*L)); }
  const body = new THREE.LatheGeometry(pts, 16);
  body.rotateZ(-Math.PI/2); body.scale(1, 1, Wd/H);
  if(P.body === 'sturgeon' || P.body === 'catfish' || P.body === 'goby') body.translate(0, 0, 0);
  const tmp = new THREE.Vector3();
  tint(body, (v, c) => {
    const t = clamp(0.5 - v.x/L, 0, 1), r = profile(P.body, t)*H, u = clamp(v.y/(r || 1), -1, 1);
    c.copy(belly).lerp(side, clamp((u + 1)*0.75, 0, 1)); if(u > 0.1) c.lerp(top, clamp((u - 0.1)/0.7, 0, 1));
    const n = hash(Math.round(t*40 + seed*7), Math.round(u*9 + Math.atan2(v.z, v.y)*4));
    if(P.pattern === 'spots' && u > -0.1 && n > 0.86) c.multiplyScalar(0.55);
    if(P.pattern === 'spots-light' && n > 0.9) c.lerp(belly, 0.8);
    if(P.pattern === 'bars' && u > -0.5 && Math.sin(t*46 + seed) > 0.55) c.multiplyScalar(0.72);
    if(P.pattern === 'stripe' && Math.abs(u) < 0.22) c.lerp(new THREE.Color(0xD98C9A), 0.55);
    if(P.pattern === 'stripe-dark' && Math.abs(u + 0.1) < 0.16 && t > 0.15) c.multiplyScalar(0.62);
    if(P.pattern === 'mottle' && n > 0.62) c.multiplyScalar(0.7 + 0.3*hash(n*9, t*3));
    if(P.pattern === 'scutes' && (Math.abs(u - 0.95) < 0.12 || Math.abs(Math.abs(u) - 0.35) < 0.1) && Math.sin(t*70) > 0.2) c.lerp(belly, 0.6);
    if(P.pattern === 'scales' && hash(Math.round(t*30), Math.round(u*12)) > 0.5) c.multiplyScalar(0.88);
    if(t < 0.06) c.lerp(top, 0.3);
  });
  const parts = [body];
  const fin = (g, x, y, z, rx, ry, rz, dark) => { g.rotateX(rx || 0); g.rotateY(ry || 0); g.rotateZ(rz || 0); g.translate(x, y, z); tint(g, (v, c) => c.copy(finC).multiplyScalar(dark || 1)); parts.push(g); };
  const tl = 0.24*L, th = H*1.25;
  if(P.tail === 'fork') fin(shapeGeo([[0, 0],[-tl, th],[-tl*0.55, 0],[-tl, -th]]), -L/2 + 0.02*L, 0, 0);
  else if(P.tail === 'round') fin(shapeGeo([[0, 0],[-tl*0.6, th*0.9],[-tl, th*0.5],[-tl*1.05, 0],[-tl, -th*0.5],[-tl*0.6, -th*0.9]]), -L/2 + 0.02*L, 0, 0);
  else if(P.tail === 'hetero') fin(shapeGeo([[0, 0],[-tl*1.4, th*1.1],[-tl*0.7, th*0.1],[-tl*0.6, -th*0.35]]), -L/2 + 0.02*L, 0, 0);
  else if(P.tail === 'eel') fin(shapeGeo([[0, 0],[-tl*0.5, th*0.35],[-tl*0.8, 0],[-tl*0.5, -th*0.3]]), -L/2 + 0.02*L, 0, 0);
  if(P.dorsal === 'short') fin(shapeGeo([[0, 0],[-0.02*L, H*0.85],[-0.14*L, H*0.95],[-0.18*L, 0]]), 0.05*L, H*0.85, 0);
  else if(P.dorsal === 'long') fin(shapeGeo([[0, 0],[-0.02*L, H*0.9],[-0.38*L, H*0.6],[-0.4*L, 0]]), 0.14*L, H*0.85, 0);
  else if(P.dorsal === 'spiny'){ fin(shapeGeo([[0, 0],[-0.03*L, H*0.95],[-0.16*L, H*0.75],[-0.2*L, 0]]), 0.12*L, H*0.85, 0, 0, 0, 0, 0.8); fin(shapeGeo([[0, 0],[-0.02*L, H*0.8],[-0.14*L, H*0.7],[-0.16*L, 0]]), -0.1*L, H*0.85, 0); }
  else if(P.dorsal === 'back') fin(shapeGeo([[0, 0],[-0.02*L, H*0.7],[-0.12*L, H*0.75],[-0.14*L, 0]]), -0.2*L, H*0.7, 0);
  if(P.tail !== 'eel'){
    fin(shapeGeo([[0, 0],[-0.02*L, -H*0.6],[-0.12*L, -H*0.55],[-0.14*L, 0]]), -0.18*L, -H*0.85, 0);
    for(const s of [-1, 1]) fin(shapeGeo([[0, 0],[0.02*L, -H*0.1],[-0.12*L, -H*0.55],[-0.14*L, -H*0.05]]), 0.16*L, -H*0.3, s*Wd*0.85, 0, s*0.6, 0);
  }
  const geo = merge(parts);
  const mesh = new THREE.Mesh(geo, VMAT());
  const pos = geo.attributes.position.array, base = new Float32Array(pos), tArr = new Float32Array(geo.attributes.position.count);
  for(let i = 0; i < tArr.length; i++) tArr[i] = clamp(0.5 - base[i*3]/L, 0, 1);
  mesh.userData.anim = {base, t:tArr, L, amp:(P.body === 'eel' ? 0.16 : P.body === 'sturgeon' || P.body === 'pike' || P.body === 'gar' ? 0.045 : 0.075)*L, freq:(P.body === 'eel' ? 4 : 5.5)/Math.max(0.35, Math.sqrt(L)), k:(P.body === 'eel' ? 7 : 3.4), phase:seed*7};
  const g = new THREE.Group(); g.add(mesh);
  const em = mat(0x111111, {roughness:.3}), eye = new THREE.SphereGeometry(0.035*L + 0.004, 8, 6);
  for(const s of [-1, 1]){ const e = new THREE.Mesh(eye, em); e.position.set(0.33*L, H*0.25, s*Wd*0.85); g.add(e); }
  if(P.barbels){ const bm = mat(0x3A3630); for(const s of [-1, 1]){ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.16*L, 4), bm); b.position.set(0.45*L, -H*0.1, s*Wd*0.5); b.rotation.z = -1.1; b.rotation.y = s*0.6; g.add(b); } }
  return g;
}
function wagFish(g, time){
  const mesh = g.children[0], A = mesh.userData.anim; if(!A) return;
  const pos = mesh.geometry.attributes.position.array, b = A.base, t = A.t;
  const ph = time*A.freq + A.phase;
  for(let i = 0; i < t.length; i++){
    const u = t[i], w = A.amp*(0.08 + 0.92*u*u)*Math.sin(ph - A.k*u);
    pos[i*3] = b[i*3]; pos[i*3 + 1] = b[i*3 + 1]; pos[i*3 + 2] = b[i*3 + 2] + w;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}
function musselGroup(P, seed){
  const g = new THREE.Group(), s = P.size;
  const shell = P.striped ? mat(P.col) : mat(P.col, {roughness:.5});
  for(const side of [-1, 1]){
    const h = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8, 0, Math.PI), shell);
    h.scale.set(1.5, 1, 0.55); h.rotation.y = side < 0 ? Math.PI : 0; h.position.z = side*0.004; g.add(h);
    h.userData.side = side;
  }
  if(P.warty){ const wm = mat(new THREE.Color(P.col).multiplyScalar(1.2).getHex()); for(let i = 0; i < 12; i++){ const w = new THREE.Mesh(new THREE.SphereGeometry(s*0.12, 5, 4), wm); w.position.set((hash(i, seed) - .5)*s*2.4, (hash(i + 3, seed) - .5)*s*1.4, (hash(i, seed + 9) > .5 ? 1 : -1)*s*0.5); g.add(w); } }
  if(P.striped){ const zm = mat(0x4A3F32); for(let i = 0; i < 4; i++){ const z = new THREE.Mesh(new THREE.TorusGeometry(s*(0.5 + i*0.3), s*0.05, 4, 12), zm); z.rotation.x = Math.PI/2; z.position.x = -s*0.6 + i*s*0.45; z.scale.set(1, 1, 0.6); g.add(z); } }
  g.rotation.set(0.9, hash(seed, 2)*6, 0.2);
  g.userData.open = 0.06 + hash(seed, 5)*0.05;
  return g;
}
function birdGroup(kind){
  const g = new THREE.Group();
  if(kind === 'eagle'){
    const dark = mat(0x3A2E22), white = mat(0xF0EDE4), yellow = mat(0xE2B531);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dark); body.scale.set(2.2, 1, 1); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), white); head.position.set(0.36, 0.05, 0); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), yellow); beak.rotation.z = -Math.PI/2; beak.position.set(0.5, 0.03, 0); g.add(beak);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.26), white); tail.position.set(-0.4, 0, 0); g.add(tail);
    for(const s of [-1, 1]){
      const w = new THREE.Group(); w.position.set(0.02, 0.06, s*0.1);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.55), dark); inner.position.z = s*0.28; w.add(inner);
      const outer = new THREE.Group(); outer.position.z = s*0.55;
      const om = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.6), dark); om.position.z = s*0.3; outer.add(om);
      for(let f = 0; f < 5; f++){ const fe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.16), dark); fe.position.set(-0.12 + f*0.06, 0, s*(0.62 + f*0.02)); outer.add(fe); }
      w.add(outer); w.userData.outer = outer; w.userData.s = s; g.add(w); g.userData['wing' + (s < 0 ? 'L' : 'R')] = w;
    }
  } else {
    const grey = mat(0x7C8A94), dark = mat(0x3C4650), white = mat(0xE9EAE6), yellow = mat(0xD9C15A);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), grey); body.scale.set(1.6, 1, 0.9); body.position.y = 0.95; g.add(body);
    const neck = new THREE.Group(); neck.position.set(0.25, 1.05, 0); g.add(neck); g.userData.neck = neck;
    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8), grey); n1.position.set(0.1, 0.25, 0); n1.rotation.z = -0.35; neck.add(n1);
    const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.4, 8), white); n2.position.set(0.2, 0.62, 0); n2.rotation.z = 0.25; neck.add(n2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), white); head.position.set(0.17, 0.85, 0); head.scale.set(1.5, 1, 1); neck.add(head);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), dark); crest.position.set(0.09, 0.9, 0); neck.add(crest);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 6), yellow); beak.rotation.z = -Math.PI/2; beak.position.set(0.4, 0.84, 0); neck.add(beak);
    for(const s of [-1, 1]){ const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.85, 6), dark); leg.position.set(-0.02, 0.44, s*0.07); g.add(leg); }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.34), dark); wing.position.set(-0.05, 1.03, 0); g.add(wing);
  }
  return g;
}
function mammalGroup(kind){
  const g = new THREE.Group();
  const spec = {otter:{col:0x5A4634, len:0.85, r:0.09, tail:0.35, head:0.085}, mink:{col:0x3A2A20, len:0.5, r:0.045, tail:0.2, head:0.05}, beaver:{col:0x6B4E32, len:0.75, r:0.17, tail:0, head:0.12}, muskrat:{col:0x5B4530, len:0.32, r:0.07, tail:0.25, head:0.06}}[kind];
  const fur = mat(spec.col, {roughness:.95});
  const body = new THREE.Mesh(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(spec.r, spec.len - 2*spec.r, 6, 10) : new THREE.CylinderGeometry(spec.r, spec.r, spec.len, 10), fur);
  body.rotation.z = Math.PI/2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(spec.head, 10, 8), fur); head.position.set(spec.len/2 + spec.head*0.4, spec.r*0.4, 0); head.scale.set(1.3, 1, 1); g.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(spec.head*0.25, 6, 5), mat(0x1A1614)); nose.position.set(spec.len/2 + spec.head*1.6, spec.r*0.4, 0); g.add(nose);
  const em = mat(0x111111);
  for(const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(spec.head*0.18, 6, 5), em); e.position.set(spec.len/2 + spec.head*1.05, spec.r*0.4 + spec.head*0.35, s*spec.head*0.6); g.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(spec.head*0.28, 6, 5), fur); ear.position.set(spec.len/2 + spec.head*0.2, spec.r*0.4 + spec.head*0.8, s*spec.head*0.7); g.add(ear); }
  if(kind === 'beaver'){ const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.22), mat(0x2E241C, {roughness:.6})); tail.position.set(-spec.len/2 - 0.16, -0.02, 0); g.add(tail); g.userData.tail = tail; }
  else { const tail = new THREE.Mesh(new THREE.CylinderGeometry(spec.r*0.6, spec.r*0.15, spec.tail, 6), fur); tail.rotation.z = Math.PI/2 + 0.2; tail.position.set(-spec.len/2 - spec.tail*0.45, 0.02, 0); g.add(tail); g.userData.tail = tail; }
  for(let i = 0; i < 4; i++){ const leg = new THREE.Mesh(new THREE.CylinderGeometry(spec.r*0.3, spec.r*0.25, spec.r*1.6, 6), fur); leg.position.set((i < 2 ? 1 : -1)*spec.len*0.3, -spec.r*0.9, (i % 2 ? 1 : -1)*spec.r*0.6); g.add(leg); }
  return g;
}
function turtleGroup(P){
  const g = new THREE.Group(), s = P.size, shellM = mat(P.col, {roughness:.5}), skin = mat(new THREE.Color(P.col).multiplyScalar(0.85).getHex());
  const shell = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10, 0, Math.PI*2, 0, Math.PI/2), shellM); shell.scale.set(1.15, P.flat ? 0.28 : 0.6, 1); g.add(shell);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(s*1.16, s*1.16, s*0.06, 18), skin); rim.scale.z = 1/1.15*1; g.add(rim);
  if(!P.flat){ const lm = mat(0xB8A96A); for(let i = 0; i < 9; i++){ const l = new THREE.Mesh(new THREE.TorusGeometry(s*0.14, s*0.012, 4, 10), lm); l.position.set((hash(i, 3) - .5)*s*1.4, s*0.32 + hash(i, 5)*s*0.2, (hash(i, 7) - .5)*s*1.2); l.rotation.x = Math.PI/2; g.add(l); } }
  const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.22, 8, 6), skin); head.scale.set(1.6, 0.8, 0.9); head.position.set(s*1.25, s*0.12, 0); g.add(head); g.userData.head = head;
  if(P.flat){ const snout = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.07, s*0.25, 6), skin); snout.rotation.z = -Math.PI/2; snout.position.set(s*1.62, s*0.14, 0); g.add(snout); }
  for(let i = 0; i < 4; i++){ const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.35, s*0.08, s*0.28), skin); leg.position.set((i < 2 ? 1 : -1)*s*0.7, 0, (i % 2 ? 1 : -1)*s*0.95); leg.rotation.y = (i < 2 ? 1 : -1)*(i % 2 ? 1 : -1)*0.5; g.add(leg); }
  return g;
}
function mudpuppyGroup(){
  const g = new THREE.Group(), skin = mat(0x6B5642, {roughness:.6});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8), skin); body.rotation.z = Math.PI/2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); head.scale.set(1.5, 0.7, 1.1); head.position.set(0.17, 0, 0); g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 6), skin); tail.rotation.z = Math.PI/2; tail.position.set(-0.24, 0, 0); tail.scale.y = 1.6; g.add(tail); g.userData.tail = tail;
  const gm = mat(0xB8433A); for(const s of [-1, 1]) for(let i = 0; i < 3; i++){ const gill = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.07, 4), gm); gill.position.set(0.1 - i*0.02, 0.02, s*(0.06 + i*0.015)); gill.rotation.x = s*1.1; gill.rotation.z = 0.3; g.add(gill); }
  for(let i = 0; i < 4; i++){ const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 5), skin); leg.position.set((i < 2 ? 1 : -1)*0.1, -0.03, (i % 2 ? 1 : -1)*0.05); leg.rotation.x = (i % 2 ? 1 : -1)*1.2; g.add(leg); }
  return g;
}
function plantGroup(style, seed){
  const g = new THREE.Group();
  if(style === 'reed'){
    const stem = mat(0xA79A62), plume = mat(0xD8C9A4);
    for(let i = 0; i < 14; i++){ const h = 1.6 + hash(i, seed)*0.8, s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, h, 5), stem); s.position.set((hash(i, 2) - .5)*0.9, h/2, (hash(i, 4) - .5)*0.9); s.rotation.z = (hash(i, 6) - .5)*0.2; g.add(s);
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), plume); p.position.set(s.position.x, h + 0.1, s.position.z); g.add(p); }
  } else if(style === 'loosestrife'){
    const stem = mat(0x4F6B3A), purple = mat(0x9B3B8F);
    for(let i = 0; i < 12; i++){ const h = 0.9 + hash(i, seed)*0.6, s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, h, 5), stem); s.position.set((hash(i, 2) - .5)*0.9, h/2, (hash(i, 4) - .5)*0.9); g.add(s);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, h*0.4, 6), purple); p.position.set(s.position.x, h*0.85, s.position.z); g.add(p);
      for(let l = 0; l < 4; l++){ const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.025), stem); leaf.position.set(s.position.x + (l % 2 ? .04 : -.04), h*0.2 + l*h*0.12, s.position.z); leaf.rotation.z = (l % 2 ? -.5 : .5); g.add(leaf); }
    }
  } else {
    const green = mat(0x3F7A46);
    for(let i = 0; i < 16; i++){ const h = 1.2 + hash(i, seed)*0.9, s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 5), green); s.position.set((hash(i, 2) - .5)*1.4, -2.4 + h/2, (hash(i, 4) - .5)*1.2); g.add(s);
      for(let w = 0; w < 8; w++){ const whorl = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 4, 8), green); whorl.rotation.x = Math.PI/2; whorl.position.set(s.position.x, -2.4 + h*(0.2 + w*0.1), s.position.z); g.add(whorl); } }
  }
  g.userData.sway = true;
  return g;
}
function buildAnimal(name, seed){
  const P = MODELS[name]; if(!P) return null;
  switch(P.kind){
    case 'fish': return fishMesh(P, seed);
    case 'mussel': return musselGroup(P, seed);
    case 'eagle': return birdGroup('eagle');
    case 'heron': return birdGroup('heron');
    case 'otter': case 'mink': case 'beaver': case 'muskrat': return mammalGroup(P.kind);
    case 'turtle': return turtleGroup(P);
    case 'mudpuppy': return mudpuppyGroup();
    case 'plant': return plantGroup(P.style, seed);
  }
  return null;
}

/* ---------- the place: a piece of river bed, the surface from below, a bank, a log, a snag ---------- */
function buildPlace(scene){
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 40, 40), mat(0x6E6250, {roughness:1}));
  bed.rotation.x = -Math.PI/2; bed.position.y = -2.5;
  const p = bed.geometry.attributes.position; for(let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i); p.setZ(i, (hash(x, y) - .5)*0.15 + (x > 7 ? (x - 7)*0.45 : 0)); }
  bed.geometry.computeVertexNormals(); scene.add(bed);
  const cob = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0x8A8272, {roughness:.9}), 260);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for(let i = 0; i < 260; i++){ const x = (hash(i, 1) - .5)*22, z = (hash(i, 2) - .5)*18, r = 0.05 + hash(i, 3)*0.22; d.position.set(x, -2.5 + (x > 7 ? (x - 7)*0.45 : 0) + r*0.3, z); d.rotation.set(hash(i, 4)*3, hash(i, 5)*3, 0); d.scale.set(r, r*0.7, r*0.9); d.updateMatrix(); cob.setMatrixAt(i, d.matrix); const v = 0.5 + hash(i, 6)*0.35; c.setRGB(v, v*0.95, v*0.85); cob.setColorAt(i, c); }
  cob.instanceMatrix.needsUpdate = true; scene.add(cob);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 30, 30), new THREE.MeshPhongMaterial({color:0x5FB3A6, transparent:true, opacity:.45, side:THREE.DoubleSide, shininess:90, specular:0xBFF0E6, depthWrite:false}));
  surf.rotation.x = -Math.PI/2; surf.position.y = 0; surf.renderOrder = 3; scene.add(surf);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 30), mat(0x9E998C)); wall.position.set(12.6, -0.4, 0); scene.add(wall);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 30), mat(0x55643E, {roughness:1})); bank.position.set(19.4, 1.55, 0); scene.add(bank);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5, 10), mat(0x6A5238, {roughness:1})); log.rotation.z = Math.PI/2; log.rotation.y = 0.35; log.position.set(8.4, 0.05, 2.2); scene.add(log);
  const snag = new THREE.Group(); const sm = mat(0x4E3B2A);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6, 8), sm); trunk.position.set(15, 4.6, -6); trunk.rotation.z = 0.15; snag.add(trunk);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 4.5, 6), sm); branch.position.set(12.9, 6.2, -6); branch.rotation.z = Math.PI/2 - 0.35; snag.add(branch);
  scene.add(snag);
  const rays = new THREE.Group();
  for(let i = 0; i < 12; i++){ const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.25 + hash(i, 8)*0.35, 6), new THREE.MeshBasicMaterial({color:0xBFF0E6, transparent:true, opacity:.03 + hash(i, 9)*0.035, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending})); ray.position.set((hash(i, 1) - .5)*14, -2.5, (hash(i, 2) - .5)*10); ray.rotation.y = hash(i, 3)*3; ray.rotation.z = 0.18; rays.add(ray); }
  scene.add(rays);
  const N = 500, pg = new THREE.BufferGeometry(), pp = new Float32Array(N*3);
  for(let i = 0; i < N; i++){ pp[i*3] = (Math.random() - .5)*24; pp[i*3 + 1] = -2.5 + Math.random()*2.5; pp[i*3 + 2] = (Math.random() - .5)*16; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({color:0xD9F3EA, size:.045, transparent:true, opacity:.5, depthWrite:false}));
  scene.add(motes);
  return {surf, motes, rays, log};
}
const VIEWS = {
  under:{pos:[0, -1.05, 6.2], look:[0, -1.5, 0]}, shallow:{pos:[4, -0.6, 4.5], look:[7, -1.3, 0]}, bed:{pos:[0, -1.6, 2.6], look:[0, -2.45, 0]},
  surface:{pos:[-1, 1.3, 6.5], look:[0, -0.1, 0]}, edge:{pos:[3, 1.6, 6.5], look:[9.5, 0.4, 0]}, sky:{pos:[0, 2.2, 9], look:[0, 6, -4]},
  log:{pos:[5.2, 2.2, 5.6], look:[8.4, 0.3, 1.8]}, bank:{pos:[10, 3.4, 6.8], look:[17, 2.2, 0]}
};

/* ---------- individuals in motion ---------- */
function spawn(name){
  const P = MODELS[name], kind = P.kind, list = [];
  const n = P.n || (P.kind === 'plant' && ART[name] ? 3 : 1);
  for(let i = 0; i < n; i++){
    const obj = ART[name] && ['fish','mussel','turtle','mudpuppy','plant'].includes(kind) ? cutout(name, P, i + 1) : buildAnimal(name, i + 1); if(!obj) continue;
    const it = {obj, name, kind, i, P, ph:hash(i, 11)*6.28, r:1, speed:P.speed || 1, cut:!!obj.userData.cut};
    if(kind === 'fish'){
      const school = n > 6;
      it.cx = school ? (hash(i, 21) - .5)*1.2 : 0; it.cz = school ? (hash(i, 22) - .5)*1.2 : 0;
      it.rx = school ? 2.6 + hash(i, 23)*0.6 : 3.4 + i*0.55; it.rz = school ? 1.3 + hash(i, 24)*0.3 : 1.5 + i*0.25;
      it.y = P.depth + (school ? (hash(i, 25) - .5)*0.9 : -i*0.25); it.ph = school ? i*0.35 + hash(i, 26) : i*2.1;
      it.bob = 0.08 + hash(i, 27)*0.1; it.dir = P.bottom ? 1 : 1;
    } else if(kind === 'mussel'){
      const s = P.size;
      obj.position.set(-1.6 + (i % 5)*0.8 + (hash(i, 31) - .5)*0.4, -2.5 + s*0.35, -0.4 + Math.floor(i/5)*0.7 + (hash(i, 32) - .5)*0.4);
      if(P.striped) obj.position.set((hash(i, 33) - .5)*2.2, -2.5 + s*0.5, (hash(i, 34) - .5)*1.6);
    } else if(kind === 'heron'){ obj.position.set(8.8, -0.35, 0.4); obj.rotation.y = -0.4; }
    else if(kind === 'eagle'){ obj.position.set(0, 6, -3); }
    else if(kind === 'turtle'){ if(it.cut && i === 1){ obj.position.set(2.5, -0.06, 1.2); it.swim = true; } else { obj.position.set(8.0 + i*0.9, it.cut ? 0.36 : 0.34, 2.0 + i*0.3); obj.rotation.y = 0.5; } }
    else if(kind === 'mink'){ obj.position.set(15.5, 1.8, 0); }
    else if(kind === 'mudpuppy'){ obj.position.set(0, -2.42, 0.4); }
    else if(kind === 'plant'){ if(it.cut){ obj.position.set(4.6 + (i - 1)*1.3, -2.45, (hash(i, 40) - .5)*1.6); obj.rotation.y = hash(i, 41)*1.2 - 0.6; } else obj.position.set(P.style === 'milfoil' ? 5 : 16, P.style === 'milfoil' ? 0 : 1.7, P.style === 'milfoil' ? 0 : -1); }
    else if(kind === 'otter' || kind === 'beaver' || kind === 'muskrat'){ it.rx = 3.5; it.rz = 1.6; it.y = kind === 'beaver' ? -0.08 : -0.12; }
    R.scene.add(obj); list.push(it);
  }
  return list;
}
function animate(list, t, dt){
  for(const it of list){
    const o = it.obj, k = it.kind;
    if(k === 'fish'){
      const a = t*0.28*it.speed*it.dir + it.ph, x = it.cx + it.rx*Math.cos(a), z = it.cz + it.rz*Math.sin(a);
      const nx = -it.rx*Math.sin(a)*it.dir, nz = it.rz*Math.cos(a)*it.dir;
      o.position.set(x, it.y + Math.sin(t*0.9 + it.ph)*it.bob, z);
      o.rotation.y = Math.atan2(-nz, nx);
      o.rotation.z = Math.sin(t*0.9 + it.ph)*0.05;
      wagFish(o, t*it.speed);
    } else if(k === 'mussel'){
      if(it.cut){ o.position.y += 0; continue; }
      const a = Math.max(0, Math.sin(t*0.6 + it.ph))*o.userData.open;
      o.children[0].rotation.x = -a; o.children[1].rotation.x = a;
    } else if(k === 'heron'){
      const neck = o.userData.neck, cyc = (t*0.25 + it.ph) % 6.28;
      neck.rotation.z = cyc < 5.6 ? Math.sin(t*0.5)*0.08 : -1.1*Math.sin((cyc - 5.6)/0.68*Math.PI);
      o.position.y = -0.35 + Math.sin(t*0.4)*0.01;
    } else if(k === 'eagle'){
      const a = t*0.22 + it.ph, rr = 5.5;
      o.position.set(rr*Math.cos(a), 6 + Math.sin(t*0.5)*0.5, -3 + rr*0.6*Math.sin(a));
      o.rotation.y = Math.atan2(-rr*0.6*Math.cos(a), -rr*Math.sin(a)); o.rotation.z = -0.35;
      const flap = Math.sin(t*3)*0.35*Math.max(0, Math.sin(t*0.3 + 1)); 
      for(const key of ['wingL', 'wingR']){ const w = o.userData[key]; if(!w) continue; w.rotation.x = -w.userData.s*flap; w.userData.outer.rotation.x = -w.userData.s*flap*0.8; }
    } else if(k === 'turtle'){
      if(it.swim){ const a = t*0.12 + it.ph; o.position.set(2.5 + 2.4*Math.cos(a), -0.06 + Math.sin(t*0.8)*0.02, 1.2 + 1.2*Math.sin(a)); o.rotation.y = Math.atan2(-1.2*Math.cos(a), -2.4*Math.sin(a)); }
      const h = o.userData.head; if(h) h.position.y = 0.12*it.P.size + Math.max(0, Math.sin(t*0.7 + it.ph))*0.04;
    } else if(k === 'otter' || k === 'beaver' || k === 'muskrat'){
      const a = t*0.2 + it.ph, x = it.rx*Math.cos(a), z = it.rz*Math.sin(a);
      const dive = k === 'otter' ? Math.max(0, Math.sin(t*0.35 + it.ph))*0.9 : 0;
      o.position.set(x, it.y - dive, z);
      o.rotation.y = Math.atan2(-it.rz*Math.cos(a), -it.rx*Math.sin(a)); o.rotation.z = Math.sin(t*2)*0.06;
      if(o.userData.tail) o.userData.tail.rotation.y = Math.sin(t*4)*0.35;
    } else if(k === 'mink'){
      const s = Math.sin(t*0.6 + it.ph); o.position.set(15.5, 1.8, s*4); o.rotation.y = s > Math.sin(t*0.6 + it.ph - 0.05) ? Math.PI/2 : -Math.PI/2;
      if(o.userData.tail) o.userData.tail.rotation.y = Math.sin(t*8)*0.3;
    } else if(k === 'mudpuppy'){
      o.position.x = Math.sin(t*0.15)*1.5; o.rotation.y = (Math.cos(t*0.15) > 0 ? 0 : Math.PI) + (it.cut ? 0.6 : 0); if(o.userData.tail) o.userData.tail.rotation.y = Math.sin(t*3)*0.3;
    } else if(k === 'plant'){ o.rotation.z = Math.sin(t*0.7)*0.03; o.rotation.x = Math.sin(t*0.5 + 1)*0.02; }
  }
}
function clearAnimals(){ if(!R || !R.list) return; for(const it of R.list){ R.scene.remove(it.obj); it.obj.traverse(m => { if(m.geometry) m.geometry.dispose(); }); } R.list = []; }

/* ---------- thumbnails rendered from the models ---------- */
async function thumbs(){
  if(!R.gl) return;
  const cv = document.createElement('canvas'); cv.width = 144; cv.height = 100;
  const rr = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true}); rr.setClearColor(0, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xE8F2EE, 0x2A3A36, 0.9));
  const sun = new THREE.DirectionalLight(0xFFF4E0, 0.9); sun.position.set(2, 3, 4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1.44, 0.01, 50);
  const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  for(const sp of SPECIES){
    if(ART[sp.n]) continue;
    const el = HOST.querySelector(`[data-sp="${CSS.escape(sp.n)}"] .lf-ico`); if(!el) continue;
    const obj = buildAnimal(sp.n, 1); if(!obj) continue;
    const P = MODELS[sp.n];
    if(P.kind === 'fish') wagFish(obj, 1.3);
    sc.add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0);
    if(P.kind === 'mussel') obj.rotation.set(0.6, 0.4, 0);
    if(P.kind === 'eagle'){ obj.rotation.y = 0.3; obj.rotation.z = -0.25; }
    box.setFromObject(obj); box.getSize(size); box.getCenter(ctr);
    const d = Math.max(size.x, size.y, size.z*0.6)*1.9 + 0.05;
    cam.position.set(ctr.x + d*0.15, ctr.y + d*0.32, ctr.z + d); cam.lookAt(ctr);
    rr.render(sc, cam);
    el.innerHTML = `<img src="${cv.toDataURL('image/png')}" alt="">`;
    sc.remove(obj); obj.traverse(m => { if(m.geometry) m.geometry.dispose(); });
    await new Promise(r => setTimeout(r, 0));
  }
  rr.dispose();
}

/* ---------- card and strip ---------- */
function monthText(sp, m){
  const s = SEASON[sp.n]; if(!s) return '';
  for(const [ms, txt] of s.ph) if(ms.includes(m)) return txt;
  return s.m[m] ? 'Present this month.' : (s.off || 'Not expected this month.');
}
function calendar(sp, m){
  const s = SEASON[sp.n]; if(!s) return '';
  return `<div class="lf-cal" aria-label="Presence by month">${MONTHS.map((n, i) => `<span class="lf-m l${s.m[i]}${i === m ? ' now' : ''}" title="${n}: ${['not here','present','active'][s.m[i]]}">${n[0]}</span>`).join('')}</div>`;
}
function card(sp){
  const m = NOW(), s = SEASON[sp.n] || {m:new Array(12).fill(1)}, lvl = s.m[m];
  const el = HOST.querySelector('#lf-card');
  el.innerHTML = `
    <div class="lf-photo${ART[sp.n] ? ' art' : ''}" id="lf-photo">${ART[sp.n] ? `<img src="${artUrl(ART[sp.n].s)}" alt="${sp.n}">` : `<div class="lf-ph-empty">${ic(GROUP_ICON[sp.g])}</div>`}</div>
    <div class="lf-body">
      <div class="lf-tags"><span class="tag ${statusClass(sp.s)}">${sp.s}</span><span class="tag ${lvl === 2 ? 't-live' : lvl === 1 ? 't-plain' : 't-muted'}">${['Not here now','Here now','Active now'][lvl]}</span></div>
      <h4>${sp.n}</h4>
      <div class="lf-size">${ic('ruler')} ${s.size || ''}</div>
      ${calendar(sp, m)}
      <p class="lf-now"><strong>${MONTHS[m]}</strong> ${monthText(sp, m)}</p>
      <details class="tw-more"><summary>${ic('info')} More</summary><p>${sp.note}</p><p class="lf-src">Timing is typical for the Grand at Grand Rapids, from DNR guidance and the research base. It is not an observation.</p><p id="lf-link"></p></details>
      <div class="tw-acts"><button class="act" data-a="ask">${ic('ask')} Ask</button><button class="act" data-a="model">${ic('cube')} In the model</button><button class="act" data-a="copy">${ic('copy')} Copy</button></div>
    </div>`;
  el.querySelector('[data-a="ask"]').onclick = () => { if(typeof ask === 'function') ask(`What is ${sp.n.toLowerCase()} doing in the Grand River at Grand Rapids in ${MONTHS[m]}?`); };
  el.querySelector('[data-a="copy"]').onclick = ev => copy(`${sp.n} (${sp.s})\n${s.size || ''}\n${MONTHS[m]}: ${monthText(sp, m)}\n${sp.note}\n\n[River Brain, seasonal timing, not an observation]`, ev.currentTarget);
  el.querySelector('[data-a="model"]').onclick = () => { if(typeof Twin !== 'undefined') Twin.flyTo(sp.g === 'mussel' ? 'mussels' : sp.n === 'Lake sturgeon' || sp.n === 'River redhorse' ? 'sturgeon' : sp.n === 'Sea lamprey' ? 'sixth' : 'water'); };
  photo(sp.w).then(p => {
    const box = el.querySelector('#lf-photo'), lk = el.querySelector('#lf-link'); if(!box) return;
    if(p && p.img && !ART[sp.n]) box.innerHTML = `<a href="${p.link}" target="_blank" rel="noopener"><img src="${p.img}" alt="${sp.n}" loading="lazy"><span>${ic('camera')} Wikipedia</span></a>`;
    if(lk) lk.innerHTML = `<a href="${p.link}" target="_blank" rel="noopener">${ic('external')} ${p.desc || 'Read more on Wikipedia'}</a>`;
  });
}
function strip(){
  const m = NOW();
  const list = SPECIES.filter(sp => FILTER === 'all' || sp.g === FILTER)
    .map(sp => ({sp, lvl:(SEASON[sp.n] || {m:[1]}).m[m] || 0}))
    .sort((a, b) => b.lvl - a.lvl);
  HOST.querySelector('#lf-strip').innerHTML = list.map(({sp, lvl}) =>
    `<button class="lf-sp l${lvl}${CUR === sp.n ? ' on' : ''}" data-sp="${sp.n}" title="${sp.n}: ${['not here now','here now','active now'][lvl]}">
      <span class="lf-ico">${ART[sp.n] ? `<img src="${artUrl(ART[sp.n].s, true)}" alt="" loading="lazy">` : ic(GROUP_ICON[sp.g])}</span><span class="lf-nm">${sp.n.replace('North American ', '')}</span>${lvl === 2 ? '<span class="lf-dot" aria-hidden="true"></span>' : ''}</button>`).join('');
  const active = SPECIES.filter(sp => (SEASON[sp.n] || {m:[]}).m[m] === 2).length;
  HOST.querySelector('#lf-count').textContent = `${active} active in ${MONTHS[m]}`;
}
function select(name, quiet){
  const sp = SPECIES.find(s => s.n === name); if(!sp) return;
  CUR = name;
  HOST.querySelectorAll('.lf-sp').forEach(b => b.classList.toggle('on', b.dataset.sp === name));
  card(sp);
  if(R && R.gl){
    clearAnimals(); R.list = spawn(name);
    const v = VIEWS[MODELS[name].view] || VIEWS.under;
    R.camTo = {pos:new THREE.Vector3(...v.pos), look:new THREE.Vector3(...v.look), t0:performance.now()};
    if(!R.camFrom){ R.camera.position.copy(R.camTo.pos); R.look.copy(R.camTo.look); }
    R.camFrom = {pos:R.camera.position.clone(), look:R.look.clone()};
  }
  const b = HOST.querySelector(`[data-sp="${CSS.escape(name)}"]`);
  if(b){ const strip = b.parentElement, target = b.offsetLeft - strip.clientWidth/2 + b.offsetWidth/2; if(quiet) strip.scrollLeft = Math.max(0, target); else strip.scrollTo({left:Math.max(0, target), behavior:'smooth'}); }
  const above = ['edge','log','bank','sky','surface'].includes(MODELS[name].view);
  R.stage.classList.toggle('above', above);
  if(R.gl){ R.scene.fog.density = above ? 0.022 : 0.075; }
}
function pickDefault(){
  const m = NOW(), order = ['fish', 'wild', 'mussel', 'inv'];
  for(const g of order){ const sp = SPECIES.find(s => s.g === g && (SEASON[s.n] || {m:[]}).m[m] === 2); if(sp) return sp.n; }
  return SPECIES[0].n;
}

/* ---------- frame ---------- */
function frame(now){
  requestAnimationFrame(frame);
  if(!R.visible || document.hidden){ R.last = now; return; }
  const dt = Math.min(0.05, (now - (R.last || now))/1000); R.last = now; R.time += dt;
  const t = R.time;
  if(R.camTo && R.camFrom){
    const k = clamp((now - R.camTo.t0)/900, 0, 1), e = 1 - Math.pow(1 - k, 3);
    R.camera.position.lerpVectors(R.camFrom.pos, R.camTo.pos, e); R.look.lerpVectors(R.camFrom.look, R.camTo.look, e);
    if(k >= 1){ R.camFrom = {pos:R.camTo.pos.clone(), look:R.camTo.look.clone()}; R.camTo = null; }
  }
  R.camera.position.y += Math.sin(t*0.5)*0.0006; R.camera.lookAt(R.look);
  animate(R.list, RM ? t*0.35 : t, dt);
  const sp = R.place.surf.geometry.attributes.position; const arr = sp.array;
  for(let i = 0; i < sp.count; i++){ const x = arr[i*3], y = arr[i*3 + 1]; arr[i*3 + 2] = Math.sin(x*0.9 + t*1.3)*0.05 + Math.cos(y*1.1 - t*0.9)*0.04; }
  sp.needsUpdate = true;
  const mp = R.place.motes.geometry.attributes.position.array;
  for(let i = 0; i < mp.length; i += 3){ mp[i + 1] += dt*0.04; mp[i] += Math.sin(t + i)*0.0006; if(mp[i + 1] > -0.05) mp[i + 1] = -2.5; }
  R.place.motes.geometry.attributes.position.needsUpdate = true;
  R.place.rays.rotation.y = Math.sin(t*0.1)*0.05;
  R.renderer.render(R.scene, R.camera);
}
let RM = false;
function resize(){
  const w = Math.max(1, R.stage.clientWidth), h = Math.max(1, R.stage.clientHeight);
  if(!R.gl) return;
  R.renderer.setSize(w, h, false); R.camera.aspect = w/h; R.camera.updateProjectionMatrix();
}
function shell(){
  const m = NOW();
  return `
  <div class="lf-head">
    <div><h3>${ic('fish')} Who is in the river</h3><p>Tap an animal to watch it and see what it is doing in ${MONTHS[m]}.</p></div>
    <div class="lf-filters" role="group" aria-label="Kind">
      <button data-g="all" class="on">All</button><button data-g="fish">${ic('fish')} Fish</button><button data-g="mussel">${ic('shell')} Mussels</button><button data-g="wild">${ic('paw')} Birds, mammals</button><button data-g="inv">${ic('bug')} Invasive</button>
      <span class="lf-count" id="lf-count"></span>
    </div>
  </div>
  <div class="lf-main">
    <div class="lf-stage" id="lf-stage" aria-label="Animated animals of the Grand River"><canvas></canvas><div class="lf-cap" id="lf-cap">${ic('eye')} Typical timing, not an observation.</div></div>
    <div class="lf-card" id="lf-card"></div>
  </div>
  <div class="lf-strip" id="lf-strip" role="listbox" aria-label="Species"></div>`;
}
function init(host){
  HOST = host; if(!host) return;
  host.innerHTML = `<div class="lf">${shell()}</div>`;
  RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stage = host.querySelector('#lf-stage');
  R = {gl:false, stage, canvas:stage.querySelector('canvas'), list:[], visible:true, time:0, look:null, camTo:null, camFrom:null};
  host.querySelector('.lf-filters').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if(!b) return; FILTER = b.dataset.g; host.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); strip(); thumbs(); });
  host.querySelector('#lf-strip').addEventListener('click', e => { const b = e.target.closest('.lf-sp'); if(b) select(b.dataset.sp); });
  if(typeof THREE !== 'undefined'){
    try{
      const renderer = new THREE.WebGLRenderer({canvas:R.canvas, antialias:true, alpha:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0F3E3B, 0.075);
      scene.add(new THREE.HemisphereLight(0xCFF0E8, 0x2A3A36, 1.05));
      const sun = new THREE.DirectionalLight(0xFFF6E6, 0.75); sun.position.set(3, 8, 5); scene.add(sun);
      const front = new THREE.DirectionalLight(0xBFE6DD, 0.35); front.position.set(-2, 1, 8); scene.add(front);
      const camera = new THREE.PerspectiveCamera(42, 1.6, 0.05, 80);
      Object.assign(R, {gl:true, renderer, scene, camera, look:new THREE.Vector3(0, -1.5, 0), place:buildPlace(scene)});
      resize();
      if(typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      if(typeof IntersectionObserver !== 'undefined') new IntersectionObserver(es => es.forEach(en => { R.visible = en.isIntersecting; }), {rootMargin:'120px'}).observe(stage);
      requestAnimationFrame(frame);
    }catch(err){ console.warn(err); R.gl = false; }
  }
  if(!R.gl){ stage.classList.add('flat'); stage.insertAdjacentHTML('beforeend', `<div class="tw-fallback">The animated view needs 3D. The calendar and photos still work.</div>`); }
  strip();
  select(pickDefault(), true);
  if(R.gl) setTimeout(() => thumbs(), 400);
}
return {init, select, season:SEASON, models:MODELS, art:ART, artUrl, month:monthText, get current(){ return CUR; }};
})();
/* ============================================================================
   APP: storage, model calls, sharing, facts, weekly deep dive
   ========================================================================= */
const HAS_WS = typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';

const store = {
  async get(k, fb){
    try{
      if(HAS_WS){ const r = await window.storage.get(k); return r ? JSON.parse(r.value) : fb; }
      const v = localStorage.getItem('rb:' + k); return v ? JSON.parse(v) : fb;
    }catch(e){ return fb; }
  },
  async set(k, v){
    try{
      if(HAS_WS){ await window.storage.set(k, JSON.stringify(v)); return true; }
      localStorage.setItem('rb:' + k, JSON.stringify(v)); return true;
    }catch(e){ return false; }
  }
};

/* ---------- toast + clipboard, the sharing primitives ---------- */
let toastT;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('up');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('up'), 1900);
}
async function copy(text, btn){
  try{
    await navigator.clipboard.writeText(text);
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(_){}
    ta.remove();
  }
  toast('Copied');
  if(btn){ const o = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('done');
           setTimeout(()=>{ btn.textContent = o; btn.classList.remove('done'); }, 1600); }
}
function plain(html){
  const d = document.createElement('div'); d.innerHTML = html;
  d.querySelectorAll('tr').forEach(tr => tr.append(document.createTextNode('\n')));
  d.querySelectorAll('td,th').forEach(td => td.append(document.createTextNode(' | ')));
  d.querySelectorAll('p,li,dd,div').forEach(n => n.append(document.createTextNode('\n')));
  return d.textContent.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

/* ---------- model ---------- */
async function apiKey(ask){
  if(HAS_WS) return null;
  let k = await store.get('key', null);
  if(!k && ask){
    k = prompt('Anthropic API key\n\nStays in this browser, only ever sent to api.anthropic.com.');
    if(k){ k = k.trim(); await store.set('key', k); }
  }
  if(!k && !HAS_WS) throw new Error('No API key set yet. Click Ask again to add one.');
  return k;
}
async function callClaude(messages, system, {tools=true, maxTokens=1300, interactive=false} = {}){
  const headers = {'Content-Type':'application/json'};
  const key = await apiKey(interactive);
  if(key){ headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
           headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
  const body = {model: MODEL, max_tokens: maxTokens, system, messages};
  if(tools) body.tools = [{type:'web_search_20250305', name:'web_search'}];
  const res = await fetch('https://api.anthropic.com/v1/messages',
                          {method:'POST', headers, body: JSON.stringify(body)});
  if(!res.ok) throw new Error(`API ${res.status}. ${(await res.text().catch(()=>'')).slice(0,180)}`);
  const d = await res.json();
  return (d.content||[]).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

/* ---------- markdown ---------- */
function md(s){
  const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let out = esc(s)
    .replace(/```([\s\S]*?)```/g,(m,c)=>`<pre style="overflow:auto;background:var(--bed-3);padding:10px;border-radius:3px;font:12px var(--mono)">${c}</pre>`)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^#{2,3}\s+(.+)$/gm,'<strong>$1</strong>');
  const lines = out.split('\n'), buf = []; let list = null, tbl = [];
  const flushT = () => {
    if(!tbl.length) return;
    const rows = tbl.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
    buf.push('<table>' + rows.map((r,i) => {
      const cells = r.replace(/^\||\|$/g,'').split('|').map(c => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    }).join('') + '</table>');
    tbl = [];
  };
  for(const ln of lines){
    if(/^\s*\|.*\|\s*$/.test(ln)){ if(list){buf.push(`</${list}>`);list=null;} tbl.push(ln.trim()); continue; }
    flushT();
    const ul = ln.match(/^\s*[-•]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
    if(ul){ if(list!=='ul'){ if(list) buf.push(`</${list}>`); buf.push('<ul>'); list='ul'; } buf.push(`<li>${ul[1]}</li>`); }
    else if(ol){ if(list!=='ol'){ if(list) buf.push(`</${list}>`); buf.push('<ol>'); list='ol'; } buf.push(`<li>${ol[1]}</li>`); }
    else { if(list){ buf.push(`</${list}>`); list=null; } if(ln.trim()) buf.push(`<p>${ln}</p>`); }
  }
  flushT(); if(list) buf.push(`</${list}>`);
  return buf.join('');
}
function confTag(c){ const [l,cls] = CONF[c] || CONF.stable; return `<span class="tag ${cls}">${l}</span>`; }

/* ---------- ask ---------- */
const convo = [];
const SEEDS = ['What is the river doing right now?','What is under the river?','What fish are in the water?',
  'Is it safe to wade this weekend?','Which dams are being removed, and why?',
  'Is Sixth Street Dam being removed?','When does the salmon run start?',
  'What is happening with mussels?','What happened in the Great Log Jam of 1883?'];

function addMsg(who, html, cls=''){
  const log = document.getElementById('log');
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.innerHTML = `<div class="who">${who}</div><div class="bd">${html}</div>`;
  log.appendChild(d);
  d.scrollIntoView({behavior:'smooth', block:'nearest'});
  return d;
}

async function ask(text){
  if(!text.trim()) return;
  const input = document.getElementById('q'), btn = document.getElementById('send');
  input.value = ''; btn.disabled = true;
  addMsg('You', md(text), 'me');
  const box = addMsg('River', `<span style="color:var(--muted);font:12px var(--mono)">reading the brain, checking live sources…</span>`);

  try{
    const ctx = retrieve(text).map(asPlain).join('\n\n');
    const learned = (await store.get('log', [])).slice(0,6)
      .map(x => `### Learned ${x.date}: ${x.title}\n${x.body}`).join('\n\n');
    const liveNote = LIVE.ok
      ? `\n\n=== LIVE GAUGE, read ${LIVE.at ? LIVE.at.toISOString() : 'just now'} ===\n${conditionLine()}\nUse these figures for any present-tense question. They are OBSERVED_LIVE.`
      : `\n\n=== LIVE GAUGE ===\nUnavailable in the browser right now. If asked about current conditions, search the web or say the live value is unavailable. Never guess.`;

    const sys = DOCTRINE
      + `\n\nToday is ${new Date().toDateString()}. Base research compiled ${BASE_DATE}.`
      + liveNote
      + `\n\n=== KNOWLEDGE BASE ===\n${ctx}`
      + (learned ? `\n\n=== LEARNED SINCE ===\n${learned}` : '');

    convo.push({role:'user', content:text});
    const raw = await callClaude(convo.slice(-8), sys, {interactive:true});
    const MAP = {OBSERVED_LIVE:'live', OFFICIAL_CURRENT:'official', STABLE_FACT:'stable',
                 SEASONAL_LIKELY:'seasonal', PLANNED_FUTURE:'planned', SCENARIO_ONLY:'scenario'};
    const m = raw.match(/\[\[CONF:(\w+)\]\]/);
    const cls = (m && MAP[m[1].toUpperCase()]) || 'stable';
    const clean = raw.replace(/\[\[CONF:\w+\]\]/g,'').trim();
    convo.push({role:'assistant', content:raw});

    const strip = stripFor(clean + ' ' + text);
    box.querySelector('.bd').innerHTML = md(clean) + strip
      + `<div class="foot-a">${confTag(cls)}
           <button class="act" data-copy>Copy answer</button>
           <button class="act" data-share>Copy with sources</button></div>`;
    hydrate(box);

    box.querySelector('[data-copy]').addEventListener('click', e => copy(clean, e.target));
    box.querySelector('[data-share]').addEventListener('click', e => copy(
      `${clean}\n\n---\nConfidence: ${CONF[cls][0]}\n${LIVE.ok ? conditionLine() + '\n' : ''}`
      + `River Brain, Grand River / Grand Rapids. Asked ${new Date().toLocaleString()}.`, e.target));
  }catch(err){
    box.querySelector('.bd').innerHTML =
      `<p style="color:var(--planned)">Could not reach the model. ${String(err.message||err)}</p>
       <p style="color:var(--muted);font-size:13px">Everything below still works offline. The whole brain is in this page.</p>`;
  }finally{ btn.disabled = false; input.focus(); }
}

/* ---------- facts ---------- */
const state = {filter:'all', find:''};
const TOPIC_ICON = {water:'drop', life:'fish', history:'history', build:'build', people:'people'};
function lead(html, n = 96){ const t = plain(html).split('\n').find(l => l.trim().length > 20) || plain(html); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }
function renderCards(){
  const q = state.find.toLowerCase().trim();
  const items = KB.filter(e => {
    if(state.filter !== 'all' && !e.f.includes(state.filter)) return false;
    if(q && !(e.t + ' ' + e.tags + ' ' + e.html).toLowerCase().includes(q)) return false;
    return true;
  });
  document.getElementById('cardcount').textContent = `${items.length} of ${KB.length} entries`;
  const box = document.getElementById('cards');
  box.innerHTML = items.length ? items.map(e => `
    <details class="card" id="c-${e.id}"${q ? ' open':''}>
      <summary>${ic(TOPIC_ICON[e.f[0]] || 'brain', 'ico')}<span class="ttl-wrap"><span class="ttl">${e.t}</span><span class="lead">${lead(e.html)}</span></span><span class="arw">›</span></summary>
      <div class="meta">${confTag(e.c)}<span class="tag t-plain">${REACHES[e.reach][0]}</span></div>
      <div class="bd">${e.html}</div>
      <div class="acts">
        <button class="act" data-c="${e.id}">${ic('copy')} Copy</button>
        <button class="act" data-l="${e.id}">${ic('link')} Copy link</button>
      </div>
    </details>`).join('')
    : `<div class="card"><div class="bd" style="padding:16px">Nothing matches. Clear the search.</div></div>`;

  box.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', ev => {
    ev.preventDefault();
    const e = KB.find(x => x.id === b.dataset.c);
    copy(`${e.t}\n${'-'.repeat(e.t.length)}\n${plain(e.html)}\n\n[${REACHES[e.reach][0]} · ${CONF[e.c][0]}] River Brain`, b);
  }));
  box.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', ev => {
    ev.preventDefault();
    copy(location.origin + location.pathname + '#c-' + b.dataset.l, b);
  }));
}

/* ---------- weekly deep dive ---------- */
const BRIEFS = [
  {t:'Construction progress', q:'Search for news from the last 14 days about Grand Rapids WhiteWater Lower Reach construction, the Grand River Revitalization Project, dam removal progress, Ah-Nab-Awen Park closures, and the Sixth Street Dam sea lamprey barrier EIS.'},
  {t:'Hydrology and weather', q:'Search for recent Grand River Michigan hydrology news: flooding, ice jams, drought, low flow, high water, NWS Grand Rapids river forecasts, record readings in the last 30 days.'},
  {t:'Fish and wildlife',     q:'Search for recent news about Grand River Michigan lake sturgeon research, snuffbox mussel, salmon and steelhead runs, DNR stocking, sea lamprey, invasive species, new species findings.'},
  {t:'Events and community',  q:'Search for upcoming and recent Grand River Grand Rapids events: festivals, cleanups, paddling events, groundbreakings, DGRI and Grand River Network announcements, Grand River Greenway trail news.'},
  {t:'Regulations and advisories', q:'Search for changes to Michigan DNR fishing regulations affecting the Grand River, MDHHS Eat Safe Fish advisories, EGLE permits, public health advisories.'},
  {t:'Development and funding',q:'Search for Grand Rapids riverfront development and funding news: new projects, brownfield incentives, park and trail funding, millages, land sales along the Grand River.'},
  {t:'History and culture',   q:'Search for newly published Grand River Michigan history, archaeology, Grand River Bands of Ottawa Indians news, museum exhibits, documentaries, books or archival discoveries.'}
];
const DIVE_SYS = `You are a research agent updating the River Brain, a reference model of the Grand River through Grand Rapids, Michigan. Base research was compiled ${BASE_DATE}.

Search the web and report ONLY genuinely new or changed information. Do not restate what was already known as of August 2026.

Format: 2 to 6 short bullets. Each bullet gives the fact, the date, and the source name in parentheses. Be specific with numbers and dates. Never use em dashes. If nothing has changed, reply with exactly: No change found.`;

async function deepDive(manual = false){
  const btn = document.getElementById('rundive'), bar = document.getElementById('divebar'),
        st = document.getElementById('divestatus');
  btn.disabled = true; const found = [];
  for(let i = 0; i < BRIEFS.length; i++){
    st.textContent = `Deep dive ${i+1} of ${BRIEFS.length}: ${BRIEFS[i].t}…`;
    bar.style.width = `${(i / BRIEFS.length) * 100}%`;
    try{
      const out = await callClaude([{role:'user', content: BRIEFS[i].q + `\n\nToday is ${new Date().toDateString()}.`}],
                                   DIVE_SYS, {maxTokens:900, interactive: manual && i === 0});
      if(out && !/^no change found\.?$/i.test(out.trim())) found.push({title:BRIEFS[i].t, body:out.trim()});
    }catch(err){
      st.textContent = `Stopped at "${BRIEFS[i].t}". ${String(err.message||err).slice(0,90)}`;
      bar.style.width = '0%'; btn.disabled = false;
      if(!found.length) return; break;
    }
  }
  bar.style.width = '100%';
  const now = new Date(), iso = now.toISOString();
  const log = await store.get('log', []);
  found.forEach(f => log.unshift({date: now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
                                  iso, title:f.title, body:f.body}));
  await store.set('log', log.slice(0,120)); await store.set('lastDive', iso);
  st.textContent = found.length
    ? `Added ${found.length} update${found.length>1?'s':''}. The brain is deeper than it was an hour ago.`
    : 'Nothing new this week. The brain is current.';
  setTimeout(()=>{ bar.style.width='0%'; }, 1400);
  btn.disabled = false; renderLog();
}

async function serverLog(){
  try{
    const r = await fetch('./data/updates.json', {cache:'no-store'});
    if(!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.entries) ? j.entries : [];
  }catch(e){ return []; }
}

async function renderLog(){
  const local = await store.get('log', []), remote = await serverLog(), seen = new Set();
  const log = [...remote, ...local]
    .filter(e => { const k = (e.iso||'') + e.title; if(seen.has(k)) return false; seen.add(k); return true; })
    .sort((a,b) => String(b.iso||'').localeCompare(String(a.iso||'')));
  let last = await store.get('lastDive', null);
  if(log.length && log[0].iso && (!last || log[0].iso > last)) last = log[0].iso;

  const le = document.getElementById('lastdive'), ne = document.getElementById('nextdive');
  if(last){
    const d = new Date(last), days = Math.floor((Date.now() - d.getTime()) / 86400000);
    le.textContent = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
    ne.textContent = `Next automatic run ${new Date(d.getTime() + 7*86400000)
      .toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
  }else{ le.textContent = 'Never run'; ne.textContent = 'Runs weekly once started'; }

  document.getElementById('entries').innerHTML = log.length ? log.map(e => `
    <div class="entry"><div class="when">${e.date}</div><h4>${e.title}</h4>
      <div class="bd">${md(e.body)}</div></div>`).join('')
    : `<div class="entry"><div class="bd" style="color:var(--muted)">No findings yet. Run a deep dive and anything new gets appended here permanently, with the date it was learned.</div></div>`;
}

async function maybeAutoDive(){
  const last = await store.get('lastDive', null);
  if(!last) return;
  if(Date.now() - new Date(last).getTime() > 7*86400000){
    if(HAS_WS || await store.get('key', null)){
      document.getElementById('divestatus').textContent = 'A week has passed. Running the weekly deep dive…';
      deepDive(false);
    }
  }
}

async function exportBrain(){
  const log = await store.get('log', []);
  let out = `# River Brain: Grand River, Grand Rapids\n\nBase research ${BASE_DATE}. Exported ${new Date().toDateString()}.\n\n`;
  if(LIVE.ok) out += `## Conditions at export\n${conditionLine()}\n\n`;
  out += `## Base corpus\n\n` + KB.map(asPlain).join('\n\n');
  if(typeof Twin !== 'undefined') out += `\n\n## The river, era by era\n\n` + Twin.eras.map(e => `### ${e.y}: ${e.t}\n${plain(e.body)}`).join('\n\n');
  out += `\n\n## Species\n\n` + SPECIES.map(s => `- ${s.n} (${s.s}): ${s.note}`).join('\n');
  out += `\n\n## River Reader\n\n` + READER.map(r => `### ${r.d}: ${r.t}\n${r.c} ${r.b}`).join('\n\n');
  out += `\n\n## Learned since\n\n` + (log.length ? log.map(e => `### ${e.date}: ${e.title}\n${e.body}`).join('\n\n') : '_Nothing yet._');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'text/markdown'}));
  a.download = `river-brain-${new Date().toISOString().slice(0,10)}.md`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Brain exported');
}

/* ---------- boot ---------- */
/* places along the river, with photos where Wikipedia has one, each flying to the model */
const PLACE_KEYS = ['sixth','bSixth','ladder','anab','bBlue','devos','amway','jw','ford','grpm','bridgewater','riverhouse','plaza','eberhard','acrisure','vanandel','bFulton'];
function renderPlaces(){
  const box = document.getElementById('placelist'); if(!box || typeof Twin === 'undefined') return;
  const items = PLACE_KEYS.map(k => ({k, d:Twin.info[k]})).filter(x => x.d);
  box.innerHTML = items.map(({k, d}) => `<button class="pl" data-place="${k}" title="Fly to ${d.t}">
      <div class="pl-img" id="pl-${k}">${ic(k.startsWith('b') ? 'dam' : k === 'anab' ? 'plant' : k === 'ladder' || k === 'sixth' ? 'dam' : 'building')}</div>
      <div class="pl-b"><div class="pl-t">${d.t}</div><div class="pl-y">${d.y || ''}</div><span class="pl-go">${ic('cube')} Fly to it</span></div></button>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('[data-place]'); if(b) Twin.flyTo(b.dataset.place); });
  items.forEach(({k, d}) => { if(!d.wiki) return; photoAny(d.wiki).then(p => { const el = document.getElementById('pl-' + k); if(el && p && p.img) el.innerHTML = `<img src="${p.img}" alt="${d.t}" loading="lazy">`; }); });
}
function heroPhoto(){
  const hero = document.getElementById('hero'); if(!hero) return;
  photoAny(['Grand_River_(Michigan)', 'Grand_Rapids,_Michigan']).then(p => {
    if(!p || !p.img) return;
    const big = p.img.replace(/\/(\d+)px-/, '/1400px-');
    const im = new Image(); im.onload = () => { hero.style.setProperty('--hero', `url("${big}")`); hero.classList.add('has-photo'); document.getElementById('herocredit').innerHTML = `<a href="${p.link}" target="_blank" rel="noopener">Photo: Wikipedia</a>`; };
    im.onerror = () => { hero.style.setProperty('--hero', `url("${p.img}")`); hero.classList.add('has-photo'); };
    im.src = big;
  });
}
function boot(){
  document.getElementById('chips').innerHTML = SEEDS.map(s => `<button>${s}</button>`).join('') + `<button class="chip-more" type="button">${ic('chevron')} More questions</button>`;
  document.getElementById('chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.classList.contains('chip-more')){ b.parentElement.classList.toggle('all'); return; }
    ask(b.textContent);
  });
  document.getElementById('send').addEventListener('click', () => ask(document.getElementById('q').value));
  document.getElementById('q').addEventListener('keydown', e => { if(e.key === 'Enter') ask(e.target.value); });

  document.getElementById('find').addEventListener('input', e => { state.find = e.target.value; renderCards(); });
  document.querySelectorAll('[data-f]').forEach(p => p.addEventListener('click', () => {
    document.querySelectorAll('[data-f]').forEach(x => x.classList.remove('on'));
    p.classList.add('on'); state.filter = p.dataset.f; renderCards();
  }));
  document.getElementById('galfilt').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if(!b) return;
    galFilter = b.dataset.g; renderGallery();
  });

  document.getElementById('rundive').addEventListener('click', () => deepDive(true));
  document.getElementById('export').addEventListener('click', exportBrain);

  /* tab highlighting */
  const tabs = [...document.querySelectorAll('nav.tabs a')];
  const obs = new IntersectionObserver(es => {
    es.forEach(en => {
      if(!en.isIntersecting) return;
      tabs.forEach(t => t.classList.toggle('on', t.getAttribute('href') === '#' + en.target.id));
    });
  }, {rootMargin:'-55px 0px -70% 0px'});
  ['now','model','life','places','facts','log'].forEach(id => { const s = document.getElementById(id); if(s) obs.observe(s); });

  renderWidgets(); renderReader(); renderGallery(); renderCards(); renderLog();
  try{ if(typeof Twin !== 'undefined') Twin.init(document.getElementById('twin')); }catch(err){ console.warn('model failed to start', err); }
  try{ if(typeof Life !== 'undefined') Life.init(document.getElementById('lifewidget')); }catch(err){ console.warn('life failed to start', err); }
  renderPlaces(); heroPhoto();
  const rf = document.getElementById('refresh'); if(rf) rf.addEventListener('click', () => { rf.disabled = true; loadLive().finally(() => { rf.disabled = false; }); });
  const sl = document.getElementById('slack'); if(sl) sl.addEventListener('click', ev => copy(conditionLine(), ev.currentTarget));

  document.getElementById('foot').innerHTML =
    `River Brain · Grand River, Grand Rapids, Michigan · base research ${BASE_DATE}<br>
     Weather and air quality from Open-Meteo. River forecast from the National Weather Service. Map tiles from USGS, Esri and OpenStreetMap contributors.<br>
     Live readings pulled straight from USGS
     <a href="${GAUGES.npark.url}" target="_blank" rel="noopener">04118564</a> and
     <a href="${GAUGES.gr.url}" target="_blank" rel="noopener">04119000</a>, provisional and subject to revision.
     Species photos and descriptions from Wikipedia.<br>
     Construction, regulations and fish advisories are time sensitive. Verify before broadcast.`;

  loadLive();
  setInterval(loadLive, 15 * 60 * 1000);   /* the gauges update every 15 to 60 minutes */
  maybeAutoDive();

  if(location.hash.startsWith('#c-')){
    const d = document.getElementById(location.hash.slice(1));
    if(d){ d.open = true; setTimeout(() => d.scrollIntoView({block:'center'}), 200); }
  }
}
document.addEventListener('DOMContentLoaded', boot);
