# Decisions

Each entry records the options considered, the choice made, and the tradeoffs. Newest entries go at the bottom.

---

## D-001 Static site on GitHub Pages, no backend (2026-10-24)
- **Options:** GitHub Pages; Cloudflare Pages/Netlify; a small server.
- **Choice:** GitHub Pages, deployed by a custom Actions workflow.
- **Why:**
  - Free, and it lives in the same place as the code and the data Actions.
  - The domain is already verified there.
  - A custom workflow has no build-frequency cap.
- **Tradeoffs:**
  - Published site under 1 GB, soft bandwidth limit of 100 GB/month, no server-side logic, no custom response headers (CSP must be a `<meta>` tag).
  - If traffic outgrows Pages, a CDN can sit in front without code changes.

## D-002 Vite + React + TypeScript strict + Tailwind v4 (2026-10-24)
- **Options:** Astro (zero-JS by default); SvelteKit; Vite + React.
- **Choice:** Vite + React.
- **Why:** the brief specifies this stack, and Ishaan already knows it, so he can review every PR. The 150 KB budget is reachable with React plus code-splitting.
- **Tradeoffs:**
  - React costs about 60 KB gzip on the initial route.
  - Pre-rendering place pages needs our own small build-time renderer (`react-dom/server`) instead of a framework's.
- **Settings:** Tailwind v4 uses CSS-first `@theme` tokens, so there's no JS config file. TS adds `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on top of `strict`, because array indexing bugs are the classic numerical-code failure.

## D-003 System fonts on the site; Noto Sans SC only for share cards (2026-10-24)
- **Options:** a web font (Inter, Noto); system stack.
- **Choice:** system stack, with CJK fallbacks (PingFang SC, Noto Sans CJK SC, Microsoft YaHei).
- **Why:**
  - Zero font bytes on the critical path.
  - A full Chinese web font is several MB.
  - Every phone already has a good CJK face.
- **Tradeoffs:**
  - Type looks slightly different by platform.
  - Canvas share cards need a predictable font, so they lazy-load a subset of Noto Sans SC (OFL).

## D-004 OMM JSON, not TLE (2026-10-24)
- **Context:** CelesTrak is phasing out TLE formats. Catalog numbers passed 99999 on 2026-07-11, and newer objects can't be expressed in TLE. Since 2026-05-09 the default `gp.php` format is CSV.
- **Choice:** always request `FORMAT=JSON` (OMM). Both propagators (satellite.js `json2satrec` and ours) consume OMM fields.
- **Tradeoff:** it's slightly larger than TLE, which is irrelevant for two to a few hundred objects.

## D-005 Budgets enforced in CI, not by convention (2026-10-24)
- **Choice:**
  - `scripts/check-bundle-size.mjs` fails CI if the initial-route JS (entry plus modulepreloads) goes over 150 KB gzip.
  - Lighthouse CI (`lighthouserc.json`, mobile emulation, 3 runs) fails if any category drops below 0.9.
- **Why:** budgets that aren't checked drift. Lighthouse reports are kept as CI artifacts and never uploaded to public storage.

## D-006 Pinned dependencies and SHA-pinned Actions (2026-10-24)
- **Choice:**
  - npm packages use exact versions (`--save-exact`) plus the lockfile.
  - Actions are pinned by commit SHA, with the tag in a comment.
  - Dependabot opens grouped monthly PRs.
- **Why:**
  - Reproducible builds.
  - Supply-chain hygiene on a public repo whose workflows can write to Pages.

## D-007 Hero animation uses SVG SMIL, not CSS `offset-path` (2026-10-24)
- **Why:**
  - `<animateMotion>` follows the path in viewBox units, so it scales with the SVG.
  - CSS `offset-path` uses CSS pixels, so it breaks when the SVG resizes.
  - `prefers-reduced-motion` is read with `useSyncExternalStore`; reduced-motion users get a still dot.

## D-008 Accessibility checked with axe-core in tests, not eslint-plugin-jsx-a11y (2026-10-24)
- **Context:** `eslint-plugin-jsx-a11y@6.10.2` (latest) only supports ESLint up to 9, and ESLint 9 is now marked unsupported.
- **Choice:** ESLint 10 for linting. Accessibility is checked by running **axe-core against the rendered DOM** in Vitest (`src/App.test.tsx`), plus the Lighthouse accessibility score of at least 0.9 in CI.
- **Tradeoffs:**
  - axe checks what actually renders (stronger than a static lint), but only for the states the tests render.
  - jsdom can't compute color contrast, so contrast is covered by Lighthouse.
  - Revisit when jsx-a11y supports ESLint 10.

## D-009 Engine covers the Moon and planets, not just stations (2026-10-24)
- **Context:** `lab:seasons` shows the ISS alone gives a worthwhile evening pass on ~30% of evenings in Fremont, both stations together ~68%. Many nights, stations alone mean "nothing tonight".
- **Choice:** add the Moon (Schlyter) and five naked-eye planets (JPL approximate elements + IAU 1976 precession + Meeus magnitudes) to the engine now. The UI shows them as "Also in tonight's sky".
- **Tradeoffs:** about 3 KB gzipped in the worker. Arcminute accuracy (validated) instead of arcsecond, which is irrelevant for naked-eye use.

## D-010 Minimal data pipeline moved from Phase 5 to Phase 2 (2026-10-24)
- **Why:** the redesigned page should show real predictions, not fixtures, and the fetch archive should start accumulating as early as possible.
- **What:**
  - `.github/workflows/data.yml` fetches `GROUP=stations&FORMAT=JSON` every 6 h (one request) and EOP daily.
  - It stops on any non-200 response and opens an issue, commits only on change, and archives every fetch.
- **Detail:** pushes made with `GITHUB_TOKEN` don't trigger other workflows, so the job starts the deploy with `gh workflow run deploy.yml` (workflow_dispatch is the documented exception).
- **Still Phase 5:** place pages, OG images, feeds, the `visual`/`last-30-days` groups.

## D-011 No camera AR as the core; a "Sky Pointer" later (2026-10-24)
See `docs/DESIGN.md#7-camera--ar-decision`. In short: eyes see these stations better than a phone camera at night, bright screens ruin dark adaptation, web compass headings carry tens of degrees of error, in-app browsers block cameras, and native apps already do AR. Phase 2 ships a "look now" state in words and fists with a live map dot; Phase 6 adds motion-guided pointing with an optional camera backdrop.

## D-012 Device tiers and an ES3-safe support check (2026-10-24)
- Support floor = Vite's `baseline-widely-available` (Safari 16.4, Chrome 111, Firefox 114).
- An inline, ES3-syntax feature check in `index.html` (Worker, `structuredClone`, `Array.prototype.at`, lookbehind regex, `Intl` time zones) adds `class="legacy"`, which reveals a static, styled page with a QR code and plain instructions.
- In-app browsers are detected by user agent **only** to show exact "open in browser" steps, never to block.

## D-013 Design direction: a departure board for the sky (2026-10-24)
- **Options:** a planetarium-style dark UI; a card dashboard (what orbitalradar does); a Flighty-like information board.
- **Choice:** information board. One big time, states that change as the pass approaches, aligned columns, hairlines instead of cards, amber reserved for the station.
- **Sky map convention:** north up, east right (map style). Non-astronomers read maps; star charts (east left) assume you're lying on your back.
- Full rules and the list of banned patterns: `docs/DESIGN.md`.

## D-014 Magnitudes exclude extinction and are calibrated to Heavens-Above (2026-10-24)
- Standard magnitudes are fitted to 15 published Fremont passes (ISS −1.5, Tiangong +0.4; residuals in `docs/learn/06-brightness.md`).
- Like other predictors, we leave out atmospheric extinction so numbers compare; the brightness *words* account for low passes.

## D-015 The accuracy reference gets the same Earth-orientation data as the engine (2026-10-24)
- Skyfield's bundled UT1 prediction was 0.136 s off current IERS data for Oct 2026, which made our satellite positions look ~60 m off.
- The generator now builds Skyfield's timescale (and polar motion) from the same CelesTrak/IERS EOP file. The remaining difference (≤ 15 m) is our documented polar-motion neglect.

## D-016 "Tonight" means the evening; ranking weights (2026-10-24)
- **Periods:** evening = 12:00–22:00 local, late night = 22:00–04:00, before dawn = 04:00–12:00. Only evening and late-night passes can be "tonight".
- **Score** = 0.45·height + 0.35·brightness + 0.2·duration. A threshold of 0.25 separates "worth going out" from "listed for completeness".
- **Bedtime filter** default: 9:30 PM, applied to the pass's end.
- Weights are judgment calls, to be revisited with soft-launch feedback.

## D-017 satellite.js's WebAssembly runtime is aliased out (2026-10-24)
satellite.js 7 re-exports an optional wasm bulk propagator that loads a pthreads worker. Vite can't nest that worker inside ours, and we don't need it. `vite.config.ts` aliases `#wasm-single-thread` / `#wasm-multi-thread` to a stub that throws. The worker chunk is 17.7 KB gzipped.

## D-018 Labs run TypeScript directly with Node (2026-10-24)
Node 22.18+ strips TypeScript types natively. Labs (`scripts/labs/*.ts`) import the real engine with no build step or extra dependency. The engine's JSON import uses `with { type: 'json' }` so it loads in both Vite and Node.

## D-019 Sky View ships now; camera optional; compass corrected and calibratable (2026-10-24)
- **Context:** Ishaan asked for a camera/"point at the sky" view and a compass wherever we give degrees, as the reason to use this over a search result. This reverses D-011's timing (it was Phase 6).
- **Choice:** a canvas sky renderer shared by the hero picture and Sky View.
  - Sensors drive the view.
  - The camera is an optional backdrop.
  - Declination comes from NOAA WMM2025 (validated against all 100 official test points).
  - Moon/planet calibration removes drift.
  - Drag-to-look is the fallback.
- **Tradeoffs:**
  - +17 KB gzipped on the initial route (95 KB of 150).
  - A lazy 10 KB star catalogue.
  - Landscape mode and iOS heading offsets need real-device testing.

## D-020 Yale Bright Star Catalogue to magnitude 4.5 (2026-10-24)
- 905 stars, 39 named, 4 patterns, ~10 KB gzipped, loaded on demand.
- Mag 4.5 is about what a suburban sky shows.
- Precessed to date; proper motion ignored (under 10″/yr for nearly all of them).
- Also powers the "passes right past Vega" landmark cue.

## D-021 The app is the sky; information lives in a sheet (2026-10-24)
- **Context:** Ishaan found the page-of-sections layout generic.
- **Choice:** the live sky fills the screen, with a camera-app mode switch (Sky / Find it / Camera) and an instrument heading tape. Everything else sits in a bottom sheet with peek, half and full heights (a side panel on wide screens).
- **Why:**
  - It puts the unique thing, *your* sky, first.
  - It borrows from pro camera and maps apps instead of web templates.
- **Tradeoff:** more state to manage and test. The SKY mode redraw is throttled to changes only (Lighthouse TBT 0).

## D-022 Archivo for instrument readouts (2026-10-24)
- Archivo (SIL OFL 1.1), instanced to weights 500–800 and widths 62–100%, Latin subset: 45 KB WOFF2, preloaded.
- Used condensed for times, bearings and labels. Body text stays in the system face.
- A deliberate, characterful choice in place of the default system look.

## D-023 Sky Camera: manual controls where allowed, stacking everywhere, native camera on iPhone (2026-10-24)
- Safari can't set exposure, ISO or focus, and the web can't drive the iOS Camera app. Chrome on many Android phones can.
- **Choice:** feature-detect and apply per-target presets, always report what was applied, and make stacking the quality engine.
- Offer the phone's own camera for the best single shot on iPhone, followed by enhancement and labelling.
- **Sky Sync** corrects the compass from the image itself.

## D-024 Product redesign: tabs and cards, following Ishaan's reference (2026-10-25)
- **Context:** the full-screen-sky layout (D-021) still read as unfinished. Ishaan shared a reference of a professional astronomy app.
- **Choice:** a tabbed app (Tonight, Sky, Camera, Passes) with image cards and a cyan action colour; amber stays reserved for the station.
- **Tradeoffs:** a second colour breaks the earlier single-accent rule, so the roles are documented (D-024 in DESIGN.md §0).

## D-025 NASA public-domain photos for objects (2026-10-25)
- Moon (LRO), Saturn and Jupiter (Cassini), Mars (Viking), Venus (Mariner 10), the ISS (Expedition 56 crew) and the Milky Way (ISS crew; cropped to remove a spacecraft label).
- Re-encoded as WebP, 3–26 KB each, credited on each card and in ASSETS.md, with no logos and no implied endorsement.
- Tiangong has no public-domain photo, so its cards show its own path drawn on the sky.

## D-026 Choose your place now (pulled forward from Phase 3) (2026-10-25)
- "Use my location" uses the browser's geolocation. The position is rounded to ~100 m and named after the nearest city; it never leaves the phone.
- City search runs on a bundled GeoNames list: every US city ≥ 15k people plus the world ≥ 120k (8,319 cities, 253 KB gzipped, loaded only when searching).
- The chosen place is saved in localStorage (a per-device convenience). Fremont stays the default, so the 3-second rule holds on first open.

## D-027 The live sky always shows the night sky (2026-10-25)
- **Context:** Ishaan expects pointing the phone to show what's really up there, even when it's hidden by daylight or clouds.
- **Choice:** the Sky and Camera views paint a night sky with every object at its real position, at any hour, with a "Daytime" note.
- **Other fixes:**
  - Pattern lines are drawn only between drawn stars.
  - The ground uses the exact horizon line of the rectilinear camera; the old polygon left grey wedges.
  - The camera is eased every frame (time-based smoothing) at a capped 1.5× pixel ratio for smooth motion on phones.
  - A "Point with your phone" button re-asks for motion access if the first request didn't take.
