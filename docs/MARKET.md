# Market scan

Purpose: know what already exists so our public claims stay true. Rules:
- Every row has a source and a check date.
- **No "first" or "only" claims** in public copy.
- No disparagement. Describe competitors factually or not at all.
- "To verify" means not yet confirmed first-hand, so it can't be used in public copy.

Last reviewed: **2026-10-24** (desk research plus first-hand use of orbitalradar, Heavens-Above and See A Satellite Tonight on a 375 px viewport).

| Product | Type | What it offers (as checked) | Status | Source |
|---|---|---|---|---|
| NASA Spot the Station | iOS/Android app (+ website) | ISS sightings, flyover schedule, notifications. Since 2025-06-12 the *website* no longer sends email/text alerts and its location search was discontinued; alerts are now app-only. | Verified (NASA page) | https://www.nasa.gov/?p=962265 |
| Heavens-Above | Website + Android app | No account needed (login optional). UI in many languages, including 简体中文 and 繁體中文. 10-day predictions for the ISS and "CSS (TIANHE-1)". Sky charts of the track against the stars. No ads seen on the homepage. | Verified (homepage, 2026-10-24) | https://www.heavens-above.com/ |
| N2YO | Website | Visible-pass tables ("show visible passes only"). Email/SMS alerts after registration. | Verified (N2YO help page) | https://n2yo.com/info/?a=22 |
| ISS Detector (RunaR) | iOS/Android app | Free with ads; paid tier removes ads; in-app add-ons (Starlink, famous objects, planets, comets). 3D globe and sky dome. Whether Tiangong is in the current add-on: to verify. | Partly verified (third-party listings) | https://www.journaldugeek.com/telecharger/loisirs/astronomie_et_espace/iss-detector.html |
| orbitalradar.com | Website | Per-city "ISS visible tonight" pages (times, compass direction, peak elevation, duration, brightness, how-to-spot tips). Separate Tiangong tracker. "Calendar export" in its full tracker (format unknown). Email/push alerts need contact details. No language selector seen. | Verified (Seattle page) | https://orbitalradar.com/iss-visible-tonight/seattle |
| AstroViewer | Website widgets | Embeddable pass widgets for ISS and Tiangong (10-day visible passes, configurable location). | Verified (widget page) | https://astroviewer.net/widgets/en/tiangong-passes.php |
| Space Station Passes | iOS app | ISS, Tiangong and 4,000+ satellites; notifications; sky chart. | Vendor listing (unverified claims) | https://apps.apple.com/us/app/-/id1578649430 |
| g7vrd pass API | HTTP API | Free "best effort" API returning JSON and iCal. | Via Wikipedia list | https://en.wikipedia.org/wiki/List_of_satellite_pass_predictors |
| Stellarium Web | Web planetarium | Includes satellites. Pass-prediction UX: to verify. | To verify | https://stellarium-web.org/ |
| Others (GoSatWatch, Look4Sat, SkySafari, Star Walk, uphere.space, tracksat.space, …) | Mixed | Listed for completeness. | To verify | https://en.wikipedia.org/wiki/List_of_satellite_pass_predictors |

## First-hand observations (2026-10-24, 375 px viewport)
These shaped `docs/DESIGN.md`. They describe what we saw on that date, not permanent facts about these products.
- **orbitalradar.com/iss-visible-tonight/seattle:**
  - First screen blank until scripts loaded.
  - Then a breadcrumb, a gradient "Support us" button, emoji icons and a grid of stat cards.
  - Headline "YES — VISIBLE TONIGHT ✅" for a next pass at 5:17 AM.
  - Countdown and sky conditions are useful ideas.
- **Heavens-Above** (Fremont, ISS and CSS pass summaries):
  - Accurate. Our engine matches its times to the second (`src/engine/passes/heavens-above.test.ts`).
  - Its table is wider than a phone screen. Directions are abbreviations, heights are degrees.
- **See A Satellite Tonight:** asks for a location (or an address for Street View) before showing anything. The Street View idea for "where to look" is clever, but needs a third-party service.
- **Real data, Fremont, week of 2026-10-24:** every visible ISS pass was before dawn, while Tiangong passed almost every evening (e.g. 7:32 PM tonight, 80° high, magnitude −2.2 per Heavens-Above). Over 8 weeks our `lab:seasons` estimates good evening passes on ~30% of evenings for the ISS alone, ~38% for Tiangong, ~68% for either.

## Design references (not competitors)
- **Flighty** (2023 Apple Design Award, Interaction): airport-signage information design, context-aware states, countdowns. https://www.apple.com.cn/newsroom/2023/06/apple-announces-winners-of-the-2023-apple-design-awards/
- **Sky Guide** (2014 Apple Design Award): red night mode. https://www.geekwire.com/2014/app-week-sky-guide-home-planetarium-iphone-ipad/

## What overlaps (so we don't claim it as unique)
- Chinese-language UI (Heavens-Above).
- Tiangong predictions (Heavens-Above, orbitalradar, AstroViewer, Space Station Passes).
- Embeddable widgets (AstroViewer).
- Per-city SEO pages and calendar export (orbitalradar).

## Where we can honestly be different
These are claims about *our* product, true once shipped:
1. **Zero taps to the answer.** One plain-language sentence at the top on open.
2. **Bilingual EN/zh-Hans place pages and share cards** designed for WeChat, where the image is the share unit.
3. **Family mode:** a bedtime filter and kid-friendly wording.
4. **Calendar subscription feeds with no account or email.**
5. **Open source with a published, CI-generated accuracy report** (`docs/accuracy/phase2.md`) and, from Phase 8, field-observation data.
7. **Evening-first framing with both stations, plus the Moon and planets** so there is usually something to see. (Others list Tiangong too; the framing is ours.)
6. **No ads, no accounts, no cookies, no third-party trackers.**

## To verify before Phase 3 public copy
- [ ] Stellarium Web: does it list upcoming visible passes for a location?
- [ ] orbitalradar calendar export: format (.ics? subscription?).
- [ ] ISS Detector: is Tiangong in the free tier, the paid tier, or not available?
- [ ] Heavens-Above: does it offer calendar export?
- [ ] Any WeChat mini-program that already does this in Chinese (needs a native speaker to search inside WeChat).
