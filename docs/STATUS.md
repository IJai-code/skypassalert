# Status

_Last updated: 2026-10-24, end of Phase 2 (PR open, awaiting review)._

## Done
### Phase 1: Foundation (merged)
Public repo, CI, the Pages deploy at https://skypassalert.com (HTTPS enforced, www → apex), docs skeleton.

### Phase 2: Engine core + redesign + device strategy (this PR)
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

## Next: Phase 3 (MVP v0.1)
- Place picker: Bay Area presets, geolocation (on-device), GeoNames city search with GeoNames attribution in the footer.
- Family mode settings (bedtime, kid wording); zh-Hans catalog for all copy.
- Share card PNG with QR code; 14-day `.ics`.
- /privacy, /about, SEO basics; pre-rendered first paint for the default place.
- Soft launch to about 10 families.

## Human tasks pending
| Who | Task |
|---|---|
| **Ishaan** | **Tonight (Sat 2026-10-24), Fremont:** step outside at **7:32 PM**, face where the sun went down, look one fist to the left. Tiangong climbs almost straight overhead (80°) and fades out high in the east-northeast at 7:36:56. Note what you see in `FIELD_LOG.md`. |
| Ishaan | Review the Phase 2 PR. Suggested reading order is in the PR's "Read this first". Run `npm run lab:seasons` (write your prediction first). |
| Ishaan | Device check after merge (GitHub Pages has no PR previews; or use `npm run dev -- --host` on home Wi-Fi): iPhone Safari, an Android phone, and inside WeChat (send the link to yourself). Note anything that looks off. |
| Parent | (From Phase 1, if not done) Porkbun email forwarding for `hello@skypassalert.com`. |
| Ishaan (optional) | If you add a `main` ruleset requiring PRs, add **GitHub Actions** to its bypass list, or the Data workflow's commits will be rejected. |

## Housekeeping done this phase
- Closed Dependabot's TypeScript 7 PR. Dependabot now ignores TypeScript majors until typescript-eslint supports TS 7 (D-006 / dependabot.yml).

## Risks and watch items
- **CelesTrak 403s from shared GitHub runner IPs** (one download per 2 h update window). The workflow soft-fails, opens an issue, and the site shows data age. Watch the first few days of scheduled runs.
- **Scheduled workflows** in public repos pause after 60 days without repo activity. The data commits count as activity.
- **Tiangong brightness:** two shadow-ending passes are ~1 mag fainter in our model than Heavens-Above's. Field observations will decide (06-brightness).
- **Long-range passes:** predictions more than ~3 days out drift by minutes. The UI shows data age and an honest note.
- Calendar subscription refresh and alarm behaviour (Phase 5) still need real-device testing.
