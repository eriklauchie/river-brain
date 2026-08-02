# River Brain — Grand River, Grand Rapids

A live reference site for the Grand River, built for the Carbon Stories team and the Grand River Revitalization Project.

Three things it does that a document cannot:

1. **Reads the gauges.** Water temperature, discharge, gage height, turbidity, dissolved oxygen and conductance come straight out of USGS every fifteen minutes, in the browser, no server needed. It tells you whether today is above or below normal for the date, in the same words Andy Guy uses in the River Reader.
2. **Answers questions with pictures.** Ask what fish are in the water and you get photos. Species images are pulled live from Wikipedia, so they never rot.
3. **Teaches itself.** A GitHub Action runs every Monday, searches for anything new about the river, and appends what it finds. The base research is never overwritten.

---

## Setup, about ten minutes

**1. Create the repo.** Put these files in the root of a new GitHub repository and push to `main`.

**2. Add the key.** Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com |

**3. Turn on Pages.** Settings → Pages → Source: **GitHub Actions**. The site is live in a couple of minutes.

**4. Run the first research pass.** Actions → Weekly deep dive → Run workflow. After that it runs itself every Monday at 07:00 UTC.

Note that the live conditions, the fact base, the species photos and sharing all work with **no key at all**. The key is only for asking questions and for the weekly research.

---

## Where the numbers come from

| Widget | Source | Refresh |
|---|---|---|
| Water temperature, turbidity, DO, conductance | USGS 04118564, North Park Street | 15 min |
| Discharge, gage height | USGS 04119000, Grand Rapids | 15 min |
| Flood ladder, 12 / 18 / 21 / 23 ft | NWS GDRM4 thresholds | static |
| Above or below normal | Interpolated monthly medians, **estimates** | static |
| Construction phase | Project schedule | static |
| Species photos | Wikipedia REST API | on view |

USGS values are **provisional** and get revised. The site says so on every readout.

The "usual for this date" figures are estimates, not published USGS medians. They are calibrated so the verdict matches the River Reader's own wording: 2,400 cfs on 10 July reads *just below average*, 1,300 cfs on 24 July reads *well below average*. Both match what Andy wrote. Swap in real USGS statistics whenever you want more rigour, in `TYPICAL` at the top of the live section.

---

## Sharing

Everything is one click away from a paste.

- **Copy for Slack** on the gauge readout gives you a one-line conditions report with the timestamp.
- **Copy** on any fact card gives clean plain text with its reach and confidence.
- **Copy link** gives a deep link straight to that card.
- **Copy answer** and **Copy with sources** on any answer.
- **Export brain** downloads the whole thing as markdown.

---

## Files

```
index.html            the site
river-brain.js        knowledge base, live gauges, species, chat, in-page dive
data/brain.json       the entire brain, machine readable
data/updates.json     everything learned since launch, written by the Action
scripts/deep-dive.mjs the weekly research pass
.github/workflows/
  weekly-deep-dive.yml  Monday cron
  pages.yml             deploy on push
```

`data/brain.json` is the portable copy: 32 fact entries, 34 species, and the River Reader archive, with reach tags and confidence classes on everything. Point any other tool at it.

## Editing

**Facts** live in the `KB` array in `river-brain.js`:

```js
{ id:'fishing', t:'Fishing calendar and access', f:['life','people'],
  reach:'MAINSTEM', c:'seasonal', tags:'salmon steelhead walleye…', html:`…` }
```

**Species** live in `SPECIES`. Only the Wikipedia page title is stored, and the photo follows:

```js
{ n:'Lake sturgeon', w:'Lake_sturgeon', g:'fish', s:'Threatened', note:'…' }
```

**Question to photo mapping** is in `ALIASES` (specific names) and `CATEGORIES` (words like "fish", "birds", "invasive").

No build step. Edit, push, done.

## The rules answers follow

In `DOCTRINE`, from the AI River Brain operating manual:

- Never invent a current reading. Read the gauge, search, or say it is unavailable.
- Gage height is not river depth.
- Lower Reach construction does not remove Sixth Street Dam.
- No purpose-built surf wave in the current design.
- Upper Reach alternatives are undecided. Label them scenario.
- Never say restoration eliminates flooding.
- No fish-eating advice without pointing at the current MDHHS guide.
- No em dashes.

## Cost

A few cents a week for the scheduled research. Live gauges and photos are free. Questions are priced per question.
