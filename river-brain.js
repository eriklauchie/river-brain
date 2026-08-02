/* ============================================================================
   RIVER BRAIN — Grand River / Grand Rapids
   A standing reference + question-answering brain for the Carbon Stories
   documentary team and the Grand River Revitalization Project.

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
  LOWER:      ['Lower Reach',  'Bridge Street to Fulton Street — active 2026-27 restoration'],
  UPPER:      ['Upper Reach',  'Ann Street to Bridge Street — Sixth Street Dam, federal EIS'],
  DOWNTOWN:   ['Downtown',     'Banks, floodwalls, bridges, parks, trails, public realm'],
  CORRIDOR:   ['Corridor',     'Grand Rapids area beyond downtown — verify locally']
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
  <p><strong>Lake sturgeon may not be targeted here.</strong> Release immediately if caught incidentally. Catch-and-release is closed statewide through July 15, opens July 16 on most waters; harvest remains illegal except in a few designated waters. Michigan licence required. DNR 2026 regulations run through March 31, 2027 — <strong>live-check before giving anyone legal advice.</strong></p>
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
  tags:'odawa anishinaabe ottawa treaty grand river bands homecoming three fires ron yob mounds hopewell',
  html:`<p>Indigenous presence <strong>predates and continues beyond</strong> settlement. Write it in the present tense where it is present tense.</p>
  <ul>
    <li>Hopewell burial mounds along the river are roughly 2,000 years old. Norton Mounds is a National Historic Landmark.</li>
    <li>Nineteen Ottawa chiefs governed lands from Lake Michigan to Lansing, main village at what is now downtown Grand Rapids.</li>
    <li>The 1821 Treaty of Chicago and later treaty relationships remain live political and cultural context.</li>
    <li>The Grand River Bands of Ottawa Indians are a current community, not a historical footnote.</li>
    <li>Homecoming of the Three Fires is a recurring June gathering at Riverside Park.</li>
  </ul>
  <p><strong>Anti-tokenism rule from the documentary outline:</strong> Indigenous voices appear across multiple chapters intentionally, not in one designated segment. Frame industrial history as <em>intention versus impact</em> rather than assigning villains.</p>`
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
  <tr><td class="num">Sep 8, 2022</td><td>Juvenile sturgeon confirmed — the river is reproducing them</td></tr>
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
  id:'onsite', t:'What a crew will see and hear on site', f:['build','craft'], reach:'LOWER', c:'seasonal',
  tags:'filming shot list construction visual sound excavator causeway turbidity ppe access christine liability insurance',
  html:`<p><strong>See:</strong> excavators and loaders working off temporary rock causeways; dump trucks and rock delivery; boulder and stone stockpiles; localised cofferdam or isolated work zones; hi-vis PPE; fencing and park closures; flow squeezed around temporary access paths; sediment plumes during active bed disturbance; finished rock features appearing section by section.</p>
  <p><strong>Hear:</strong> diesel equipment, backup alarms, rock impact and placement, trucks on the riverfront, radio comms, and the river's own sound changing as new rough-water features come alive.</p>
  <p><strong>Access reality (from the team's own record):</strong> site access runs through Christine at the City. Liability insurance with the right parties added is required before you are on the job site. One crew member was let on while another was turned away on the same week, so confirm every time. Rain does not automatically stop work; ask about the rain plan rather than assuming.</p>
  <p><strong>Turbidity is not pollution.</strong> If you film a brown plume, caption it as construction sediment under monitoring, not a spill.</p>`
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
  <p><strong>How it will read on camera by discharge.</strong> Low: rock tops and boulder fields exposed, small fast tongues, individual riffles legible. Moderate: strongest rapids readability, whitewater lines, boulder wakes, seams and eddies distinct. High: rocks submerge, river reads broad and continuous, rough water increases but geometry hides. Flood: do not glamorise. Model volume, debris, pier turbulence, inundated edges and closures.</p>`
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
  id:'events', t:'Annual events versus one-offs', f:['people','craft'], reach:'DOWNTOWN', c:'official',
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
  <p><strong>Rare or one-off.</strong> The <strong>Grand River Expedition</strong> is a source-to-mouth paddle roughly every ten years: 1990 (launched by Verlen Kruger), 2000, 2010 (largest, ~300 paddlers, 54 completing 220+ miles). A 2020 edition was cancelled by COVID. Return to the River, Paddlefest, River for All, snow snake competitions, luminary bike rides and the Ionia and Flat River cleanups run as programmes or occasional events — confirm dates with organisers each year.</p>
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
  id:'trivia', t:'Trivia worth putting on camera', f:['people','history','craft'], reach:'MAINSTEM', c:'stable',
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
{
  id:'crew', t:'Our aspect: what Carbon Stories is actually contracted to do', f:['craft'], reach:'DOWNTOWN', c:'official',
  tags:'carbon stories team crew erik wayne duane alister layah atlanta dgri client role deliverable invoice cadence we our us who',
  html:`<p>Carbon Stories is the content and media production partner for the <strong>Grand River Revitalization Project</strong>, working to DGRI (Downtown Grand Rapids Inc.) and alongside the Grand River Network, City of Grand Rapids, Grand Rapids WhiteWater, LGROW and GR Parks.</p>
  <dl class="kv">
    <dt>Erik</dt><dd>Founder and creative director. Primary camera, shoots 8K, drone operator</dd>
    <dt>Wayne (Duane)</dt><dd>Producer and client liaison. Briefs, calendar, delivery, the person the client asks</dd>
    <dt>Alister</dt><dd>Editor. Recaps, reels, vertical reformats, captions</dd>
    <dt>Layah</dt><dd>Field capture and shoots</dd>
    <dt>Atlanta</dt><dd>Event calendar and coordination</dd>
  </dl>
  <p><strong>Scope:</strong> photo, video, drone, interviews, reels and recaps across river construction, greenway trail projects, groundbreakings, activations and community events. Billed as recurring monthly "Grand River corridor b-roll and activation."</p>
  <p><strong>Standing expectations:</strong> bi-weekly client updates; content log kept current; master catalogue at carbonstories.us/rivercontent for client self-service; deliver photos same-day when an event contact asks; watch every edit before it goes out (a partner once re-scored a cut and blew out the mix).</p>
  <p><strong>House style:</strong> 30 fps timeline for river work, or the fast-motion reads wrong against the rest of the series. Horizontal and vertical versions of most reels. Captions on reels, because reels get watched silent.</p>`
},
{
  id:'doc', t:'River for All: the documentary structure', f:['craft'], reach:'MAINSTEM', c:'planned',
  tags:'documentary chapters river for all ron yob jordan hamilton outline chapter 1 vignettes river shorts',
  html:`<p><strong>Four chapters.</strong> Ch 1 "What is the Grand River?" community and history. Ch 2 "The Process," designers, engineers, planners, policymakers. Ch 3 "The Work," construction. Ch 4 "The Grand River," the revitalised river.</p>
  <p><strong>Chapter 1 outline.</strong> 30 to 45 minutes, narrated by <strong>Ron Yob</strong>, music by <strong>Jordan Hamilton</strong>. Thesis: <em>a river shaped the City. Now the City is rediscovering its river.</em> Six movements:</p>
  <ol>
    <li>Intro, 3-4 min. Ron with the river</li>
    <li>Before the City Listened: the river as life, 5-7 min. Indigenous relationship</li>
    <li>Progress at a Cost, 5-7 min. Settlement and industrialisation</li>
    <li>The Reckoning: when the river pushed back, 5-8 min</li>
    <li>Choosing Repair: from control to care, 7-10 min</li>
    <li>A River Re-Imagined: the river as partner, 7-10 min</li>
  </ol>
  <p>Tone moves grounding and sacred, to credible with emotional weight, to proof and tangible change. Interview pool: GRPM historians, Indigenous historians, university historians, city and county professionals, environmental scientists, community members, a fisherman, river sports people, and populations with limited river access.</p>
  <p><strong>River Shorts vignettes</strong>, 2-3 min each plus 30-60 second social cuts: Water Quality, Public Safety, Clean Water Action, History, The Grand Vision, Why the Dam Needs to Be Removed, Social Equity, Sea Lamprey, Fishing, Kayaking, Equitable Access, Economic Impact, Spirit of the River, White Water, People Engaging with the River.</p>`
},
{
  id:'shotlog', t:'Seasonal shot windows', f:['craft'], reach:'MAINSTEM', c:'seasonal',
  tags:'filming shoot shooting shot shots windows photography fog ice fall color drone capture timing when to film schedule next weeks b-roll broll',
  html:`<p>High-value visual states, and roughly when to get them:</p>
  <table><tr><th>Shot</th><th>Window</th></tr>
  <tr><td>Fog over cold-warm water transition</td><td>Late fall and early spring mornings</td></tr>
  <tr><td>Ice and open-water contrast, mouth of the river</td><td>January to mid-February, before the melt</td></tr>
  <tr><td>Spring high flow and debris</td><td>March to April, from bridges and floodwalls</td></tr>
  <tr><td>Low summer flow exposing boulders</td><td>August to September, best read of new rock features</td></tr>
  <tr><td>Autumn colour plus salmon fishing</td><td>Mid-to-late October</td></tr>
  <tr><td>Night bridge reflections</td><td>Year-round, best on still cold nights</td></tr>
  <tr><td>Construction milestones and rock placement</td><td>July to November 2026, then June to October 2027</td></tr>
  <tr><td>Post-project riffle patterns at different discharges</td><td>From fall 2027, shoot the same frame at low, moderate and high flow</td></tr>
  <tr><td>Fish ladder flooding</td><td>Early April, on a high-water day</td></tr></table>
  <p>Shoot the same locked-off frame across seasons and flows. That comparison is the whole story of the project and it cannot be recreated later.</p>`
},

/* ------------------------------------------------------------ ERROR TRAPS */
{
  id:'traps', t:'Never say this', f:['water','build','life','craft'], reach:'MAINSTEM', c:'stable',
  tags:'errors mistakes never say wrong corrections traps narration script accuracy safe safety depth deep pristine spill flood claim write copy',
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
  id:'sources', t:'Where the facts come from', f:['water','history','build'], reach:'BASIN', c:'stable',
  tags:'sources bibliography usgs nws nrcs egle dnr mdhhs grpm whitewater citations',
  html:`<ul>
    <li>USGS 04119000 and 04118564 — live discharge, stage, temperature, water quality</li>
    <li>NOAA / NWS gauge GDRM4 — flood thresholds, forecasts, historic crests</li>
    <li>NWS Grand Rapids 1991-2020 climate normals</li>
    <li>USDA NRCS, Lower Grand River Habitat Restoration Final EA, January 2026</li>
    <li>Grand Rapids WhiteWater — project design, funding, permits, mussels, EIS status</li>
    <li>City of Grand Rapids — contract award Feb 2026, funding approval Mar 2026, sewer improvement, wastewater, climate plan, River for All</li>
    <li>Michigan EGLE — permits and biological assessments</li>
    <li>Michigan DNR — 2026 fishing regulations (through Mar 31, 2027), Grand River Assessment 2011, species records</li>
    <li>MDHHS Eat Safe Fish</li>
    <li>Great Lakes Fishery Commission and USACE — Upper Reach EIS</li>
    <li>Grand River Bands of Ottawa Indians</li>
    <li>Grand Rapids Public Museum, History Grand Rapids, Junior League historical markers</li>
    <li>LGROW, WMEAC, Grand Rapids Rowing, Grand River Network River Reader</li>
  </ul>
  <p>Base research compiled ${'August 1, 2026'}. Construction, regulations, advisories and hydrology are time sensitive and get refreshed by the weekly deep dive.</p>`
}
];

/* ---------- the doctrine the model answers under ---------- */
const DOCTRINE = `You are the River Brain: a spatially and temporally aware model of the Grand River through Grand Rapids, Michigan. You were built for Carbon Stories, the media production team documenting the Grand River Revitalization Project.

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

VOICE: direct, specific, useful to a film crew. No preamble. Lead with the answer. Short paragraphs. Use markdown. No em dashes anywhere, ever. Use commas, colons or parentheses instead. If something in the knowledge below is relevant, use it and say so plainly rather than hedging.`;

/* ============================================================================
   RETRIEVAL — cheap keyword scoring so the model gets the right 6-8 entries
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

async function usgs(sites, params){
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${sites}`
            + `&parameterCd=${params}&siteStatus=all`;
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok) throw new Error('USGS ' + res.status);
  const j = await res.json();
  const out = {};
  for(const ts of (j?.value?.timeSeries || [])){
    const code = ts?.variable?.variableCode?.[0]?.value;
    const site = ts?.sourceInfo?.siteCode?.[0]?.value;
    const pt   = ts?.values?.[0]?.value?.slice(-1)[0];
    if(!code || !pt) continue;
    const num = parseFloat(pt.value);
    if(!isFinite(num) || num <= -999999) continue;   /* -999999 is the USGS no-data flag */
    const meta = P[code]; if(!meta) continue;
    out[`${site}:${meta.k}`] = { v:num, at:pt.dateTime, label:meta.label, unit:meta.unit };
  }
  return out;
}

async function loadLive(){
  try{
    const vals = await usgs(
      `${GAUGES.npark.id},${GAUGES.gr.id}`,
      '00010,00060,00065,00300,00095,63680,00400'
    );
    if(!Object.keys(vals).length) throw new Error('No current readings returned');
    LIVE.vals = vals; LIVE.ok = true; LIVE.err = null;
    const stamps = Object.values(vals).map(v => v.at).filter(Boolean).sort();
    LIVE.at = stamps.length ? new Date(stamps[stamps.length-1]) : new Date();
  }catch(err){
    LIVE.ok = false; LIVE.err = err.message || String(err);
  }
  renderWidgets();
}

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

function flowVerdict(val, d = new Date()){
  if(val == null) return null;
  const r = val / interp(TYPICAL.flowMed, d);
  if(r < 0.55)  return ['Well below average','var(--alert)'];
  if(r < 0.90)  return ['Just below average','var(--seasonal)'];
  if(r <= 1.15) return ['About average','var(--live)'];
  if(r <= 1.75) return ['Above average','var(--seasonal)'];
  return ['Well above average','var(--alert)'];
}

function tempVerdict(f, d = new Date()){
  if(f == null) return null;
  const diff = f - interp(TYPICAL.tempMed, d);
  if(diff <= -10) return ['Much colder than usual','var(--official)'];
  if(diff <=  -5) return ['Cooler than usual','var(--official)'];
  if(diff <    5) return ['About normal for the date','var(--live)'];
  if(diff <   10) return ['Warmer than usual','var(--seasonal)'];
  return ['Much warmer than usual','var(--alert)'];
}

const fmt = (n, d=0) => n == null ? '—'
  : n.toLocaleString('en-US',{minimumFractionDigits:d, maximumFractionDigits:d});

/* ---------- the widgets ---------- */
const RB_ICN={
temp:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/></svg>',
flow:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8c3-2.2 6 2.2 9 0s6-2.2 9 0M3 13c3-2.2 6 2.2 9 0s6-2.2 9 0M3 18c3-2.2 6 2.2 9 0s6-2.2 9 0"/></svg>',
level:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V9M12 21V4M19 21v-8"/><path d="M3 17c3-1.8 6 1.8 9 0s6-1.8 9 0"/></svg>',
build:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M6 21l2.5-9 3.5 2 1.5-5 4.5 12"/></svg>',
gauge:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19a8 8 0 1 1 16 0"/><path d="M12 19l4-5"/></svg>',
leaf:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20c9 1 15-5 15-14 0 0-12-1-15 6-1.4 3.3 0 8 0 8z"/><path d="M4 20c2.5-6 6-8.5 10-9.5"/></svg>'
};
function rbMeter(pct,color,gA,gB){var p=Math.max(0,Math.min(100,pct)),gid='m'+Math.floor(Math.random()*1e6),mx=(4+p/100*192);return '<svg class="viz" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+(gA||'var(--rule-2)')+'"/><stop offset="1" stop-color="'+(gB||'var(--live)')+'"/></linearGradient></defs><rect x="4" y="8" width="192" height="6" rx="3" fill="url(#'+gid+')" opacity=".55"/><rect x="'+(mx-2.5).toFixed(1)+'" y="2" width="5" height="18" rx="2" fill="var(--bed)"/><rect x="'+(mx-1.5).toFixed(1)+'" y="3" width="3" height="16" rx="1.5" fill="'+color+'"/></svg>';}

function renderWidgets(){
  const m = new Date().getMonth();
  const el = document.getElementById('widgets');
  const tempC = pick('tempC'), flow = pick('flow'), stage = pick('stage');
  const tF = tempC ? cToF(tempC.v) : null;

  const tV = tempVerdict(tF);
  const fV = flowVerdict(flow?.v);

  const dead = (label, note) => `
    <div class="w w-4" style="--band:var(--muted)">
      <div class="w-head"><span class="w-lab">${label}</span></div>
      <div class="w-big" style="font-size:20px;color:var(--muted)">Unavailable</div>
      <div class="w-sub">${note}</div>
    </div>`;

  let h = '';

  /* 1. water temperature */
  const tPct = tF != null ? (tF - 32) / (86 - 32) * 100 : 0;
  h += LIVE.ok && tF != null ? `
    <div class="w w-4" style="--band:var(--live)">
      <div class="w-head"><span class="w-lab">${RB_ICN.temp}Water temperature</span><span class="tag t-live">Live</span></div>
      <div class="w-big">${fmt(tF,1)}<small>°F</small></div>
      <div class="w-sub">${fmt(tempC.v,1)} °C · usual for this date: about ${fmt(interp(TYPICAL.tempMed),0)} °F</div>
      ${rbMeter(tPct, tV?tV[1]:'var(--live)', 'var(--official)', 'var(--seasonal)')}
      ${tV ? `<span class="verdict" style="color:${tV[1]}">${tV[0]}</span>` : ''}
    </div>` : dead('Water temperature', LIVE.err ? 'Gauge unreachable: ' + LIVE.err : 'Not reporting right now');

  /* 2. discharge */
  const fBand = TYPICAL.flow[m];
  const fPct = flow ? (flow.v - fBand[0]) / (fBand[1] - fBand[0]) * 100 : 0;
  h += LIVE.ok && flow ? `
    <div class="w w-4" style="--band:var(--live)">
      <div class="w-head"><span class="w-lab">${RB_ICN.flow}Discharge</span><span class="tag t-live">Live</span></div>
      <div class="w-big">${fmt(flow.v)}<small>cfs</small></div>
      <div class="w-sub">usual for this date: about ${fmt(interp(TYPICAL.flowMed))} cfs</div>
      ${rbMeter(fPct, fV?fV[1]:'var(--live)', 'var(--official)', 'var(--seasonal)')}
      ${fV ? `<span class="verdict" style="color:${fV[1]}">${fV[0]}</span>` : ''}
    </div>` : dead('Discharge', LIVE.err ? 'Gauge unreachable' : 'Not reporting right now');

  /* 3. gage height + flood ladder */
  const s = stage?.v;
  h += `
    <div class="w w-4" style="--band:var(--official)">
      <div class="w-head"><span class="w-lab">${RB_ICN.level}Gage height</span>${s!=null?'<span class="tag t-live">Live</span>':''}</div>
      <div class="w-big">${s != null ? fmt(s,2) : '—'}<small>ft</small></div>
      <div class="w-sub">Stage above datum. <strong>Not river depth.</strong></div>
      <div class="ladder">
        ${FLOOD.map(([nm,ft,col]) => `
          <div class="rung ${s!=null && s>=ft ? 'hit':''}">
            <span class="bx" style="background:${s!=null && s>=ft ? col : 'var(--rule-2)'}"></span>
            <span class="nm">${nm}</span><span class="vl">${ft} ft</span>
          </div>`).join('')}
      </div>
    </div>`;

  /* 4. construction phase */
  const [ph, phc, phn] = phaseNow();
  h += `
    <div class="w w-4" style="--band:var(--planned)">
      <div class="w-head"><span class="w-lab">${RB_ICN.build}Construction</span><span class="tag t-official">Official</span></div>
      <div class="w-big" style="font-size:20px;line-height:1.15">${ph}</div>
      <div class="w-sub">${phn}</div>
      <div class="w-sub" style="color:var(--planned)">Lower Reach · Bridge St to Fulton St</div>
    </div>`;

  /* 5. full gauge readout, the link Erik asked to see simply */
  const rows = [
    ['Water temperature', tempC ? `${fmt(cToF(tempC.v),1)} °F` : null],
    ['Discharge',         flow  ? `${fmt(flow.v)} cfs` : null],
    ['Gage height',       stage ? `${fmt(stage.v,2)} ft` : null],
    ['Turbidity',         pick('turb') ? `${fmt(pick('turb').v,1)} FNU` : null],
    ['Dissolved oxygen',  pick('do')   ? `${fmt(pick('do').v,1)} mg/L` : null],
    ['Conductance',       pick('cond') ? `${fmt(pick('cond').v)} µS/cm` : null],
    ['pH',                pick('ph')   ? fmt(pick('ph').v,1) : null]
  ].filter(r => r[1]);

  h += `
    <div class="w w-6" style="--band:var(--live)">
      <div class="w-head">
        <span class="w-lab">${RB_ICN.gauge}Gauge readout · North Park Street 04118564</span>
        <button class="act" id="copycond">Copy for Slack</button>
      </div>
      ${rows.length ? `<dl class="reads">${rows.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`
                    : `<div class="w-sub">No parameters reporting. ${LIVE.err ? 'Error: ' + LIVE.err : ''}</div>`}
      <div class="w-sub">Provisional USGS data, subject to revision.
        <a href="${GAUGES.npark.url}" target="_blank" rel="noopener">Open gauge</a> ·
        <a href="${GAUGES.gr.url}" target="_blank" rel="noopener">Grand Rapids gauge</a></div>
    </div>`;

  /* 6. season */
  const [sn, snote] = seasonNow();
  h += `
    <div class="w w-6" style="--band:var(--seasonal)">
      <div class="w-head"><span class="w-lab">${RB_ICN.leaf}Ecological season</span><span class="tag t-seasonal">Typical</span></div>
      <div class="w-big" style="font-size:23px">${sn}</div>
      <div class="w-sub">${snote}</div>
      <div class="w-sub">Seasonal patterns are probabilities, not observations. A run has a window; a regatta has a date.</div>
    </div>`;

  el.innerHTML = h;

  document.getElementById('asof').textContent = LIVE.ok && LIVE.at
    ? `gauges read ${LIVE.at.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`
    : (LIVE.err ? 'live gauges unreachable' : 'reading the gauges…');

  const cc = document.getElementById('copycond');
  if(cc) cc.addEventListener('click', () => copy(conditionLine(), cc));
}

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

/* the Andy line, ready to paste into Slack */
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

function statusClass(s){
  if(/invasive/i.test(s)) return 'inv';
  if(/endangered|threatened|concern/i.test(s)) return 'rare';
  return '';
}

function spCard(sp, id){
  return `<a class="sp" id="${id}" href="https://en.wikipedia.org/wiki/${sp.w}" target="_blank" rel="noopener" title="${sp.note.replace(/"/g,'&quot;')}">
    <span class="ph load" data-w="${sp.w}"></span>
    <span class="cap"><span class="nm">${sp.n}</span><span class="st ${statusClass(sp.s)}">${sp.s}</span></span>
  </a>`;
}

/* fill in thumbnails after the cards are in the DOM */
async function hydrate(root){
  const slots = [...(root || document).querySelectorAll('.ph[data-w]')];
  await Promise.all(slots.map(async el => {
    const p = await photo(el.dataset.w);
    el.classList.remove('load');
    el.removeAttribute('data-w');
    if(p.img){ el.style.backgroundImage = `url("${p.img}")`; }
    else { el.style.background = 'var(--bed-4)'; el.innerHTML =
      `<span style="position:absolute;inset:0;display:grid;place-items:center;font:9px var(--mono);color:var(--muted)">no photo</span>`; }
  }));
}

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
  const host = document.getElementById('rr');
  const N = 3;
  host.innerHTML = READER.map((r,i) => `
    <div class="rr${i>=N?' rr-extra':''}"${i>=N?' hidden':''}>
      <div class="d">${r.d}</div>
      <h4>${r.t}</h4>
      <p><strong>${r.c}</strong> ${r.b}</p>
    </div>`).join('')
    + (READER.length > N ? `<button class="btn ghost" id="rr-more" style="margin-top:4px">View more (${READER.length - N})</button>` : '')
    + `<div style="font:10.5px var(--mono);color:var(--muted);margin-top:10px">
         ${READER.length} issues on record. Every one opens with temperature, flow and how they compare to the season.
       </div>`;
  const btn = document.getElementById('rr-more');
  if(btn){
    let open = false;
    btn.addEventListener('click', () => {
      open = !open;
      host.querySelectorAll('.rr-extra').forEach(n => { n.hidden = !open; });
      btn.textContent = open ? 'Show less' : `View more (${READER.length - N})`;
    });
  }
}

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
// Ask runs on a static page, so it cannot hold a secret key. It calls the shared
// server-side proxy on Erik's carbon-kiso Railway app, which injects the
// ANTHROPIC_API_KEY from its own env and forwards to Anthropic. No visitor key needed.
const CLAUDE_PROXY = 'https://carbon-kiso-production.up.railway.app/api/claude';
async function callClaude(messages, system, {tools=true, maxTokens=1300, interactive=false} = {}){
  const body = {model: MODEL, max_tokens: maxTokens, system, messages};
  if(tools) body.tools = [{type:'web_search_20250305', name:'web_search'}];
  // Ask runs on a static page and holds no key. Route to the shared server-side
  // proxy (carbon-kiso Railway app), which injects ANTHROPIC_API_KEY from its env.
  const res = await fetch(CLAUDE_PROXY,
                          {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
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
const SEEDS = ['What is the river doing right now?','What fish are in the water?',
  'Is it safe to wade this weekend?','What should we shoot in the next two weeks?',
  'Is Sixth Street Dam being removed?','When does the salmon run start?',
  'What is happening with mussels?','Write 30 seconds of narration about the 1883 log jam'];

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
      <summary><span class="ttl">${e.t}</span><span class="arw">›</span></summary>
      <div class="meta">${confTag(e.c)}<span class="tag t-plain">${REACHES[e.reach][0]}</span></div>
      <div class="bd">${e.html}</div>
      <div class="acts">
        <button class="act" data-c="${e.id}">Copy</button>
        <button class="act" data-l="${e.id}">Copy link</button>
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
  let out = `# River Brain — Grand River / Grand Rapids\n\nBase research ${BASE_DATE}. Exported ${new Date().toDateString()}.\n\n`;
  if(LIVE.ok) out += `## Conditions at export\n${conditionLine()}\n\n`;
  out += `## Base corpus\n\n` + KB.map(asPlain).join('\n\n');
  out += `\n\n## Species\n\n` + SPECIES.map(s => `- ${s.n} (${s.s}): ${s.note}`).join('\n');
  out += `\n\n## River Reader\n\n` + READER.map(r => `### ${r.d} — ${r.t}\n${r.c} ${r.b}`).join('\n\n');
  out += `\n\n## Learned since\n\n` + (log.length ? log.map(e => `### ${e.date} — ${e.title}\n${e.body}`).join('\n\n') : '_Nothing yet._');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'text/markdown'}));
  a.download = `river-brain-${new Date().toISOString().slice(0,10)}.md`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Brain exported');
}

/* ---------- boot ---------- */
function boot(){
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
  ['now','life','facts','log'].forEach(id => { const s = document.getElementById(id); if(s) obs.observe(s); });

  renderWidgets(); renderReader(); renderGallery(); renderCards(); renderLog();

  document.getElementById('foot').innerHTML =
    `River Brain · Grand River, Grand Rapids, Michigan · base research ${BASE_DATE}<br>
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
