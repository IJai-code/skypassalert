# Roadmap

One phase per session. Phases 2+ each use their own branch and a PR, and stop for Ishaan's review and merge. Every phase ends by updating `docs/STATUS.md`.

| # | Phase | Acceptance criteria |
|---|---|---|
| 1 | **Foundation** | See below. |
| 2 | **Engine core** | See below. |
| 3 | **MVP v0.1 LIVE** | See below. |
| 4 | **Own SGP4** | See below. |
| 5 | **Data + place pages** | See below. |
| 6 | **Growth features** | See below. |
| 7 | **Launch kit + campaign** | See below. |
| 8 | **Accuracy + credibility** | See below. |

## 1. Foundation
- [ ] Public repo, MIT license, README, CLAUDE.md and docs/ skeleton.
- [ ] CI green: lint, format, typecheck, test, build, JS budget, Lighthouse ≥90 ×4 (mobile).
- [ ] Brand basics: palette, logo, favicon, placeholder "Look up tonight. Coming soon."
- [ ] Deployed by Actions to Pages at https://skypassalert.com with HTTPS enforced. www → apex, http → https.
- [ ] STATUS.md written.

## 2. Engine core
- `src/engine` is framework-free with ≥90% line coverage.
- Time: UTC/UT1/TT/GMST.
- Frames: TEME → ECEF → geodetic → topocentric az/el/range.
- Sun position and observer darkness.
- Shadow: both cylindrical and conical models.
- Magnitude model with stated error.
- Pass finder with root-finding: rise, peak and set to ≤1 s against reference, plus visibility sub-intervals.
- `Propagator` interface plus a satellite.js adapter marked TEMPORARY. Inputs are OMM JSON.
- Web Worker wrapper.
- Reference-validation harness in CI: Python Skyfield/sgp4, thousands of random times and observers. Max and mean errors published in `docs/accuracy/`; target sub-100 m position error vs the reference, and the true number is reported.
- Time-zone tests: DST transitions, the southern hemisphere, unusual offsets.
- Learn chapters 01–07 plus at least two `npm run lab:<name>` labs. GLOSSARY and DECISIONS updated.

## 3. MVP v0.1 LIVE
- **3-second rule:** best pass rendered with zero taps from the cached place.
- **Places:** Fremont and Bay Area presets, geolocation (stays on device), in-browser GeoNames city search (lazy).
- **Family mode:** bedtime filter (default 9:30 PM) and kid wording.
- **Sharing and calendar:** share card PNG (EN/zh, sky arc, QR code); one-off 14-day `.ics` with alarms.
- **Languages:** en and zh-Hans, marked "needs native-speaker review".
- **Trust:** data age and an uncertainty note on every prediction; /privacy, /about, disclaimer, GeoNames attribution.
- **SEO and budgets:** SEO basics; JS budget and Lighthouse budget met.
- **Real-device smoke test:** iPhone Safari, Android Chrome, WeChat in-app browser.
- **Soft launch** to about 10 trusted families, with a feedback form (docs/growth/LAUNCH.md soft-launch section).

## 4. Own SGP4
- Near-earth SGP4 ported from the published Vallado reference. Deep-space orbits (period ≥ 225 min) are refused with a clear error.
- Passes the Vallado verification test vectors for near-earth cases.
- Both propagators behind the interface. A diff test shows user-visible differences within documented tolerances.
- Default switches to ours. satellite.js stays as a comparison and test oracle.
- Accuracy report v1 in the repo and on /how-it-works.

## 5. Data pipeline + place pages
- Scheduled fetch Action (6 h + manual):
  - One request per group, `FORMAT=JSON`.
  - Stops on non-200 and opens an issue.
  - Commits only on change and archives every fetch.
- Daily rebuild Action.
- Pre-rendered place pages for the Bay Area and the top ~1,000 cities, in EN and zh-Hans: next 7 days of passes, sunrise/sunset, tips, FAQ.
- Unique titles and descriptions, canonical URLs, hreflang, JSON-LD, sitemap.xml, robots.txt.
- Build-time OG images.
- webcal feeds for presets and top cities, with refresh behavior documented (Google about 12–24 h, not configurable).
- Published site stays well under 1 GB (target under 300 MB).
- Stretch: `visual` and `last-30-days` groups for "bright thing tonight" (feasibility verified first).
- Search Console and Bing steps written for the parent.

## 6. Growth features
- `/embed/<place>` widget with a "powered by" link.
- PWA and offline support.
- Compass "which way to look" view (iOS permission tap).
- "Tell a neighbor" prompt (at most once a day, never nagging).
- `?s=` source tags.
- Analytics proposal → approval → parent creates the account → integration (cookieless). Then the "I saw it!" aggregate counter.
- Optional WebGL orbit view, only if the budget holds.

## 7. Launch kit + campaign
docs/growth/ contains:
- LAUNCH.md (soft launch → staged public launch).
- Launch-window finder script (ranks the next 30 days of Fremont evening passes).
- EN/zh message pack per channel, each with a `?s=` link and share image.
- Printable flyer and poster (print CSS → PDF) with QR code.
- Verified outreach target list.
- 90-day sky calendar with ready posts.
- MEDIA.md and WEEKLY.md.

Then the public-launch checklist: real-device matrix and link previews in WhatsApp, iMessage, Slack and Discord.

## 8. Accuracy + credibility
- Field-observation protocol and FIELD_LOG workflow.
- Accuracy report v2 with observed-vs-predicted data.
- Write-up of method and results.
- Post-launch iteration loop driven by WEEKLY.md metrics.
