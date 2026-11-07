# Status

_Last updated: 2026-11-06, Phase 3a (Family night) in review, stacked on Phase 2.9 (PR #11)._

## Done
### Phase 1: Foundation (merged)
Public repo, CI, the Pages deploy at https://skypassalert.com (HTTPS enforced, www → apex), docs skeleton.

### Phase 2: Engine core + redesign + device strategy (merged 2026-10-24)
- **Engine** (`src/engine`, framework-free, 97.8% line coverage, CI-enforced ≥ 90%):
  - Time scales with IERS ΔUT1.
  - TEME → ECEF → geodetic → az/el.
  - Sun, Moon and planets.
  - Cylindrical and conical shadow.
  - Pass finder with Brent root-finding.
  - Brightness model calibrated to published values.
  - Plain-language helpers.
  - `Propagator` interface + TEMPORARY satellite.js adapter (OMM JSON).
  - Runs in a Web Worker (17.7 KB gzipped, lazy).
- **Accuracy vs Skyfield** (CI job regenerates the reference each push):

  | Quantity | Max error |
  |---|---|
  | Satellite position | 14.9 m |
  | Rise/set | 0.27 s |
  | Sun | 39″ |
  | Sunset | 3 s |
  | Moon | 5.9′ |
  | Planets | 4.6′ |

  Full report: `docs/accuracy/phase2.md`.
- **Cross-check vs Heavens-Above:** 15 real Fremont passes, including the 2026-11-01 DST change. Times match to ≤ 2 s.
- **Live data:** the Data workflow fetches CelesTrak `GROUP=stations` every 6 h and EOP daily. It stops and opens an issue on any non-200, archives every fetch, and redeploys on change.
- **Redesign** (`docs/DESIGN.md`): a live, real answer for Fremont.
  - Tonight's best pass in plain words, a computed sky map, a tonight timeline with bedtime, and the week as a board.
  - The Moon and planets, red night mode, a one-pass calendar reminder.
  - In-app browser steps, a desktop QR handoff, and a static page for unsupported browsers.
- **Budgets:** initial JS 78.4 KB gzipped (budget 150). Local Lighthouse mobile 100/100/100/100, CLS 0.
- **Learning:** chapters 01–07, 09, 10 with worked examples from tonight's pass. Labs: `lab:sidereal`, `lab:shadow`, `lab:pass`, `lab:seasons`.
- **Research answers:** why use this instead of a search, the camera/AR decision, device tiers. See `docs/DESIGN.md` §1, §6, §7 and `docs/MARKET.md`.

### Phase 2.5: Sky View, live compass, sky picture (2026-10-24)
- **Hero:** a picture of tonight's pass as you'll see it, with real twilight, stars, planets and the path with minute marks.
- **Sky View** ("Find it in the sky"):
  - Point the phone at the sky. An arrow guides you to where the station appears.
  - Optional camera backdrop, preview of the pass, time scrubber, red light.
  - Drag-to-look on laptops.
- **Compass:**
  - True north via NOAA WMM2025 (all 100 official test points pass).
  - Moon/planet calibration.
  - The sky map turns into a live compass dial with true and magnetic bearings.
- **Landmark cue:** "It passes right past Vega" (Yale Bright Star Catalogue).
- **Numbers:** 209 tests; initial JS 95 KB (budget 150); Lighthouse 100 ×4.
- **Needs real devices:** iPhone (heading offset, permission prompt), Android, and landscape mode. See `docs/learn/11-compass.md`.

### Phase 2.6: Sky Camera + redesign (2026-10-24)
- **Redesign:** the app is now the live sky with a camera-app mode switch (Sky / Find it / Camera), an aircraft-style heading tape and an instrument sheet. Typeface: Archivo condensed.
- **Sky Camera:**
  - Targets from the sky model (Moon, planets, bright stars, stations).
  - Sky Sync corrects the compass from bright objects in the camera image.
  - Burst capture with sharpness ranking, alignment and stacking (lighten-stacking for station trails), plus per-target enhancement.
  - Manual exposure, ISO and focus where the browser allows it (many Android phones).
  - Native-camera path with recipes for iPhone.
  - Before/after comparison, captioned save and share. Nothing is uploaded.
- **Numbers:** 218 tests; initial JS 101 KB (budget 150); Lighthouse 98–99 / 100 / 100 / 100.
- **Not yet verified on a real phone:** the camera, stacking on real frames, and Sky Sync. These need an outdoor test.

### Phase 2.7: Product redesign + your own location (2026-10-25)
- **Tabbed app** following Ishaan's reference: Tonight (cards), Sky (live), Camera (Sky Camera), Passes (week).
  - Cyan for actions; amber for the station.
  - Image cards with NASA public-domain photos.
- **Hero card:** tonight's pass drawn on the real sky, plus stat tiles. Pass cards show each pass's own sky.
- **Cleaner Sky Sync overlay:** rings on the Moon and planets, compass letters, one target tag.
- **Location:**
  - "Use my location" (on-device, rounded to ~100 m).
  - Search over 8,319 cities.
  - Remembered on the device.
  - Checked worldwide: Sydney shows its ISS pass and the Southern Cross.
- **Calendar:** "Add this week's best to my calendar" as one file.
- **Numbers:** 223 tests; initial JS 105 KB; Lighthouse 97 / 100 / 100 / 100.

### Phase 2.8: The Night + Wave Back (2026-11-02, merged)
- **The Night:** the Tonight tab is one scroll through the night over the real sky.
  - Pass stops scrub the station along its path.
  - A time rail shows real times.
  - On no-pass nights the headline is honest.
  - Week rows open that night.
- **Wave Back:** Earth from above the station at your minute.
  - Real day/night, the ground track in sunlight or shadow, your town.
  - A computed sentence says why you can see it.
  - A share card made on the phone.
  - Sub-points match Skyfield within 14 m (CI).
- **Tabs:** 3 (Tonight, Sky with Find/Photograph, Week). Teal cards are retired for near-black night and glass chrome.
- **Numbers:** 242 tests; initial JS 105.7 KB (budget 150); Wave Back is a 6.4 KB lazy chunk plus 17 KB of Earth data on first flip; Lighthouse 98 / 100 / 100 / 100.
- **Needs a real phone:** scroll feel, the share sheet (iOS / Android / WeChat), and night mode outdoors.

### Phase 2.9: The Almanac (2026-11-03, PR in review)
- **Look:** the whole app is set like a printed star almanac: serif times, mono figures, cream on blue-black, hairline rules, text links (D-031). Chosen by Ishaan from three mockups.
- **Tonight:** running head, the answer, a star-atlas chart of the pass beside the directions, the night as a ruled table that opens line by line, and the next good evenings.
- **Week, Wave Back, Sky tab, sheets:** restyled to match. The scrolling sky, rail, thumbnails, icons and photos are retired.
- **Needs a real phone:** legibility of the italic outdoors, red mode, and the wave card share.

### Phase 3a: Family night (2026-11-06, PR in review; D-032)
- **Bedtime** (default 9:30 pm, on the device): passes after it are listed and marked, never headlined. A clearly better late pass gets a footnote.
- **Simple words:** a kid register of every pass sentence, with the same facts.
- **Meteor showers:** 12 IMO major showers, keyed by solar longitude. Tonight's best shower is a table line with an honest rate range, where to look, and the Moon's effect. Learn chapter 15.
- **Up instead:** on nights with no good pass, the answer shows the Moon, the brightest planet, or a shower.
- **Two weeks in your calendar:** one `.ics` with every good evening pass before bedtime, each with an alarm. Far-off events warn that times can shift.
- **/privacy/ and /about/:** static pages with no app JS. Footer links.
- **SEO:** sitemap, JSON-LD, `og.png` link preview from original SVG.
- **Wording fix:** passes that end because dawn brightens the sky no longer say "sets".
- **Numbers:** 273 tests; initial JS 106.7 KB (budget 150); forecast 15 days in ~0.2 s; Lighthouse 97 / 100 / 100 / 100 on `/`, 100 ×4 on `/privacy/` and `/about/`.

## Next: Phase 3b (MVP v0.1, continued)
- zh-Hans: move all copy into a catalog, then translate, marked needs-native-review.
- Pre-rendered first paint for the default place.
- Real-device smoke test (iPhone Safari, Android Chrome, WeChat), then a soft launch to about 10 families.
- ~~Place picker~~ (D-026), ~~share card~~ (D-030), ~~14-day `.ics`, family mode, meteors, /privacy, /about, SEO basics~~ (D-032): done.

## Human tasks pending
| Who | Task |
|---|---|
| **Ishaan** | **Tonight (Sat 2026-10-24), Fremont:** step outside at **7:32 PM**, face where the sun went down, look one fist to the left. Tiangong climbs almost straight overhead (80°) and fades out high in the east-northeast at 7:36:56. Note what you see in `FIELD_LOG.md`. |
| Ishaan | Read through the merged PR's "Read this first" list. Run `npm run lab:seasons` (write your prediction first). |
| Ishaan | **Outdoors with a phone:** tap "Find it in the sky", allow motion, and check that the drawn stars and Moon line up with the real ones. Try "Fix compass" with the Moon. On iPhone, Android, and inside WeChat. Note anything off. |
| **Ishaan** | **/about:** edit the "Who makes it" paragraph (`about/index.html`, marked `data-draft`). Decide what, if anything, to say about yourself. |
| Ishaan | **Check the meteor table:** open the IMO 2026 calendar (imo.net, "Meteor Shower Calendar 2026", Table 5) and compare its dates, λ☉, radiants and ZHRs with `src/engine/meteors/showers.ts`. We couldn't extract the PDF text here. |
| Ishaan | **Leonids, night of 16–17 Nov:** step out before dawn, count meteors for 15 minutes, compare with the app's range, and note it in `FIELD_LOG.md`. |
| Ishaan | On a phone: set a bedtime, turn on simple words, and add the next 2 weeks to the calendar. Check that the alarms appear. |
| Parent | (From Phase 1, if not done) Porkbun email forwarding for `hello@skypassalert.com`. |
| Ishaan (optional) | If you add a `main` ruleset requiring PRs, add **GitHub Actions** to its bypass list, or the Data workflow's commits will be rejected. |

## Verified after merge (2026-10-24)
- CI green on PR #2: lint/test/build/budget, Skyfield accuracy job (first GitHub run), Lighthouse.
- Deploy succeeded. https://skypassalert.com serves the live preview: tonight's answer is Tiangong at 7:32 PM, with no console errors.
- The Data workflow, run once by hand:
  - Elements were unchanged since this morning's fetch, so no commit.
  - EOP refreshed and committed by the bot.
  - The bot-triggered redeploy succeeded.
- The whole pipeline works end to end. Scheduled runs take over from here.

## Housekeeping done this phase
- Closed Dependabot's TypeScript 7 PR. Dependabot now ignores TypeScript majors until typescript-eslint supports TS 7 (D-006 / dependabot.yml).

## Risks and watch items
- **CelesTrak 403s from shared GitHub runner IPs** (one download per 2 h update window). The workflow soft-fails, opens an issue, and the site shows data age. Watch the first few days of scheduled runs.
- **Scheduled workflows** in public repos pause after 60 days without repo activity. The data commits count as activity.
- **Tiangong brightness:** two shadow-ending passes are ~1 mag fainter in our model than Heavens-Above's. Field observations will decide (06-brightness).
- **Long-range passes:** predictions more than ~3 days out drift by minutes. The UI shows data age and an honest note.
- Calendar subscription refresh and alarm behaviour (Phase 5) still need real-device testing.
