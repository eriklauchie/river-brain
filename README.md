# River Brain: Grand River, Grand Rapids

A live reference site for the Grand River through Grand Rapids and the Grand River Revitalization Project. Icons and pictures first, words behind the info buttons. Styled to match the Grand River Greenway downtown hub: cream paper, white cards, pill buttons, coral for the one thing to press, blue for the water.

What it does that a document cannot:

1. **Reads the river right now.** Water temperature, flow, height, clarity, oxygen, pH and conductance straight from USGS every fifteen minutes. Weather and air quality from Open-Meteo. The National Weather Service stage forecast. Sunrise and golden hour for the camera. A wade or paddle read derived from the numbers, labelled as derived. Every tile has an info button that explains what the number means and links its source.
2. **Shows the river in 3D on the real map, at true scale.** Downtown from Ann Street to Wealthy Street on real coordinates. The water sits where it really sits, a few metres below the floodwalls; the bridges are low and long; buildings come from OpenStreetMap footprints at their mapped heights, with parks, streets and trees, and cast shadows like the Greenway map. Nine moments in time, from the rapids before 1826 to the undecided Upper Reach. Only the ground below the riverbed is stretched, so the strata can be read. Tap anything.
3. **Shows who is in the water this month.** Every one of the 34 species is a small animated 3D animal built from primitives. Tap a salmon and it swims; tap a heron and it wades. The card says what the animal is doing this month, with a twelve-month presence bar, its size, a photo from Wikipedia, and the full note behind More.
4. **Teaches itself.** A GitHub Action runs every Monday, searches for anything new about the river, and appends what it finds.

---

## Setup, about ten minutes

**1. Create the repo.** Put these files in the root of a new GitHub repository and push to `main`.

**2. Add the key.** Settings, then Secrets and variables, then Actions, then New repository secret:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com |

**3. Turn on Pages.** Settings, then Pages, then Source: **GitHub Actions**. The site is live in a couple of minutes.

**4. Run the first research pass and the city map.** Actions, then Weekly deep dive, then Run workflow. Do the same for City map data, which writes `data/city.json` from OpenStreetMap. After that the dive runs every Monday and the city refreshes monthly.

Everything except asking questions works with **no key at all**. The key is only for Ask and for the weekly research.

---

## The page, top to bottom

| Section | What is there |
|---|---|
| Ask | The question box and the starter questions. On a phone only four show until you tap More. |
| Right now | Thirteen tiles: water temperature, flow, water height with the flood ladder, river forecast, clarity, oxygen, chemistry, weather, air quality, light, wade or paddle, season, construction. Info button on every one. Refresh and Copy conditions in the header. |
| The river in 3D | The model. Views: All, Dam, Downtown, Rapids, Amp, Under, Map. Ground: model (default, the Greenway look), satellite photo, or street map. Nine eras on a timeline with Play. Layers: water, ground, built, labels, 2013 flood. Every card has Prev and Next through what is on screen. The cross-section slider runs Ann Street to Wealthy Street. |
| Life in the river | The animated animals, the species strip sorted by who is active this month, the card with the calendar. All 34 species with photos are folded below it. |
| Places on the river | Seventeen places with photos where Wikipedia has one. Tap one and the model flies to it. |
| Facts | 31 entries, collapsed to an icon, a title and one line. Tap to open. Search and filter. Copy and Copy link on each. |
| River Reader | Andy Guy's dispatches, folded. |
| Learning log | The weekly dive, run it now, export the whole brain as markdown. |

---

## Where the numbers come from

| Tile | Source | Refresh |
|---|---|---|
| Water temperature, clarity, oxygen, chemistry | USGS 04118564, North Park Street | 15 min |
| Flow, water height, 7 day sparklines | USGS 04119000, Grand Rapids | 15 min |
| Usual for today | USGS daily median when the site has a long enough record, otherwise an estimate calibrated to the River Reader | daily |
| River forecast | NWS NWPS gauge GDRM4 | on load and refresh |
| Weather, light | Open-Meteo forecast API | on load and refresh |
| Air quality | Open-Meteo air quality API, US AQI from the CAMS model | on load and refresh |
| Wade or paddle | Derived from flow, height and temperature. A rule of thumb, not an advisory | with the gauges |
| Buildings, parks, streets | OpenStreetMap, fetched into `data/city.json` by the monthly City map data workflow. If the file is missing the page asks Overpass directly; if that fails the landmark boxes stand in | monthly |
| Satellite photo | USGS The National Map, with Esri World Imagery as the fallback | on demand, cached by the browser |
| Street map | CARTO Voyager, with OpenStreetMap as the fallback | on demand |
| Photos | Wikipedia REST API, page title only is stored | on view |

USGS values are **provisional** and get revised. The site says so on every readout. Everything is read in the browser; there is no server and nothing is stored.

---

## The model

Real geography, true scale above the riverbed. Twelve crossings carry real coordinates (the bridge midpoints where a published coordinate exists, estimates for the plain street bridges). The river centreline is a smooth curve through them and every station of the physics is stretched onto it, so the water, dams, walls and strata line up with the satellite photo within about a bridge width. Buildings are placed by their real coordinates with approximate footprints and real heights. Only the ground below the riverbed is stretched, five times, so the strata can be read. The model says so on screen.

Data that shapes it, all in `river-brain.js` inside the `Twin` module:

- `XINGS`: the crossings with latitude, longitude and station.
- `LANDMARKS`: the buildings, with footprint, height, era and Wikipedia title.
- `ERAS`: the nine moments and their text.
- `INFO`: what each tappable thing says, per era.
- `WS`, `BED_E`: the water surface and bed in feet by station.

Change a number, reload, and the model, cross-section and physics all follow. A test harness lives in the build notes: water above bed, bed above rock, strata continuous, flood inside the walls, and no landmark standing in the river.

## River Life

`SEASON` in the `Life` module holds, for every species, a twelve-month presence array (0 not here, 1 present, 2 active) and short texts by month. `MODELS` holds the recipe for each animal: body profile, fins, colours, pattern, how many swim, how deep, which camera. The thumbnails in the strip are rendered from the same models at load time, so there is nothing to draw by hand when a species is added.

Timing is typical for the Grand at Grand Rapids, from DNR guidance and the research base. The card says so.

## Artwork

`art/` holds the painted illustrations, one per species, cut out on transparent backgrounds as WebP: `<slug>.webp` for the card and the swimming cut-out in the 3D scene, `<slug>-t.webp` for the strip. Twenty four species have art. The ten without (snuffbox mussel, purple wartyback, bald eagle, great blue heron, river otter, American mink, beaver, muskrat, purple loosestrife, phragmites) use the built 3D model until their paintings arrive. To add one: drop the two files in `art/` and add the species to the `ART` map at the top of the `Life` module with its image proportions and viewpoint (`side`, `top`, `oblique` or `upright`).

## Sharing

- **Copy conditions** gives a one-line conditions report with the timestamp.
- **Copy** on any tile, card, place or animal gives clean plain text with its confidence.
- **Copy link** gives a deep link to a fact card.
- **Export brain** downloads the whole thing as markdown, including the model's eras.

## Files

```
index.html            the site, with the inline icon sheet
river-brain.js        knowledge base, live tiles, species, 3D model, river life, chat, deep dive
art/                  painted species illustrations, WebP, transparent
data/brain.json       the entire brain, machine readable, including the life calendar and model coordinates
data/updates.json     everything learned since launch, written by the Action
scripts/deep-dive.mjs the weekly research pass
scripts/city.mjs     buildings, parks and streets from OpenStreetMap into data/city.json
data/city.json        written by the City map data workflow
.github/workflows/
  weekly-deep-dive.yml  Monday cron
  city.yml              monthly city map refresh
  pages.yml             deploy on push
```

No build step. Edit, push, done.

## The rules answers follow

In `DOCTRINE`, from the AI River Brain operating manual, and carried into every widget:

- Never invent a current reading. Read the gauge, search, or say it is unavailable.
- Gage height is not river depth.
- Lower Reach construction does not remove Sixth Street Dam.
- No purpose-built surf wave in the current design.
- Upper Reach alternatives are undecided. The model draws them as violet ghosts labelled scenario.
- Never say restoration eliminates flooding.
- No fish-eating advice without pointing at MDHHS Eat Safe Fish.
- Seasonal timing is typical, not observed. The wade or paddle read is derived, not official.
- No em dashes.

## Brand

Palette from the DGRI brand guide: River Blue #1D4289, County Sky Blue #307FE2, Field Green #34B78F, Forest Green #00966C, Black #252A36, Neutral Gray #D9E1E2, Sunrise Yellow #FFB81C, Sunset Orange #FF8F1C, Warm Red #F9423A. Roboto throughout. The variables sit at the top of `index.html`.

## Cost

A few cents a week for the scheduled research. Everything else is free public data.
