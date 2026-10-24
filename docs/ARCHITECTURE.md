# Architecture

Static site on GitHub Pages. No backend. All prediction math runs in the browser (inside a Web Worker) and, at build time, in Node scripts that pre-render pages, OG images and calendar feeds. Both use the same engine code.

```
CelesTrak GP (OMM JSON) ──(Action, every 6 h)──▶ data/elements/*.json  + data/archive/YYYY/MM/<ts>.json
GeoNames cities + zh names ──(one-time script)──▶ public/data/cities/*.json (lazy-loaded)
                                                   │
             ┌─────────────────────────────────────┼───────────────────────────────┐
             ▼                                     ▼                               ▼
   Browser: React UI ◀─postMessage─▶ Web Worker ── src/engine ── Node build scripts: place pages,
   (3-second answer, share card,      (pass finder)               OG images, webcal feeds, sitemap
    .ics, family mode, i18n)
```

## Repository layout (target)
```
src/
  engine/        framework-free math (no React, no DOM); unit tested; runs in worker + Node
    time/        UTC↔JD, UT1 (ΔUT1 table), TT (ΔT), GMST
    frames/      TEME → ECEF (GMST rotation; polar motion documented as neglected) → geodetic (WGS-84) → topocentric az/el/range
    sun/         low-precision solar position (documented error), observer darkness
    shadow/      cylindrical and conical (umbra/penumbra) Earth-shadow models
    propagate/   Propagator interface; satellitejs-adapter.ts (TEMPORARY); sgp4/ (ours, Phase 4)
    passes/      pass finder: coarse scan + bracketed root-finding (Brent) for rise/set, golden-section/Brent for peak
    brightness/  standard-magnitude + phase-angle model with stated error
    place.ts     Place type (name, lat, lon, elevationM, timeZone [IANA])
  worker/        Web Worker entry: receives Place + elements, returns passes
  i18n/          string catalogs (en, zh-Hans), formatting via Intl (time zones, numbers)
  ui/            React components and routes
scripts/         build-time generators (pages, OG, feeds), data fetchers, labs, budget checks
data/            committed orbital elements + archive (Phase 5)
validation/      Python Skyfield/sgp4 reference generator + comparison (Phase 2)
docs/            product, architecture, decisions, learn chapters, growth assets
```

## Engine design
- **Interface first.**
  ```ts
  interface Propagator {
    readonly id: string                       // 'satellitejs' | 'skypass-sgp4'
    init(elements: OrbitalElements): Satellite // throws DeepSpaceNotSupported for period ≥ 225 min (ours)
  }
  interface Satellite {
    propagate(utc: Date): { rTeme: Vec3Km; vTeme: Vec3KmS }
  }
  ```
  Both implementations live behind this interface. A test runs the full pass finder through each one and asserts that user-visible fields (rise/peak/set to the second, direction to 1°, peak elevation to 0.1°, magnitude to 0.1) agree within documented tolerances.
- **Input format:** OMM JSON from CelesTrak (`FORMAT=JSON`). TLE is being phased out, and catalog numbers above 99999 can't be represented in it.
- **Visibility:** elevation ≥ `minElevationDeg` (default 10°), observer Sun altitude ≤ −6° (civil twilight, configurable), and the satellite sunlit (conical model; cylindrical kept for comparison).
- **Pass finder:** step coarsely (~30–60 s) over the window, bracket each elevation crossing and refine with Brent's method to under 0.1 s. The peak comes from maximizing elevation. Visibility sub-intervals (shadow entry/exit, darkness start/end) are also root-found, so "fades out at 7:45:12" is exact.
- **Time:** we own UTC/UT1/TT/GMST conversions with tables and documented approximations. Local time comes from `Intl.DateTimeFormat` with IANA zones only, never fixed offsets. Tests cover DST transitions, the southern hemisphere, and unusual offsets (e.g. +05:45, +10:30/+11:00 Lord Howe).
- **Validation (Phase 2+):** a CI job generates reference positions and az/el with Python Skyfield/sgp4 over thousands of random times and observers. Then Vitest compares and writes max and mean error to `docs/accuracy/`. We report the true numbers.

## Data pipeline (Phase 5)
- **Scheduled Action** (cron every 6 h + `workflow_dispatch`):
  - One request per group per run: `https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=JSON`, with optional `visual` and `last-30-days`.
  - Pick ISS (`ISS (ZARYA)`, NORAD 25544) and Tiangong (`CSS (TIANHE)`, NORAD 48274) by name, with a NORAD-ID cross-check.
  - Write versioned JSON and commit only on change. Archive every fetch with a timestamp; this builds our own accuracy dataset.
- **CelesTrak policy:**
  - Data updates every 2 h; a repeat download before then returns 403.
  - More than 50 errors in 2 h gets the IP firewalled.
  - So: stop on any non-200 response, never retry in a loop, and open or update a GitHub issue after N consecutive failures. The site keeps serving the last data and shows its age.
- **Daily rebuild:** place pages (EN/zh), OG images, webcal feeds, sitemap.

## Performance budget
- **Initial route:** under **150 KB gzipped JS**, enforced by `scripts/check-bundle-size.mjs` in CI.
- **Lighthouse mobile:** ≥90 in performance, accessibility, best practices and SEO, enforced by `lighthouserc.json` in CI.
- **Lazy loads:** the city index, share-card renderer (canvas + QR + font subset), WebGL view, and .ics generator.
- **First paint:** the 3-second answer must render from cached elements and a cached place before any lazy chunk loads. Phase 3 pre-renders HTML for the default place so first paint already has an answer.

## Privacy architecture
- No cookies and no third-party requests at runtime. `localStorage` holds only the saved place and preferences, on the device.
- Geolocation coordinates never leave the device. We round them for display and never put them in URLs.
- Share links use the place slug or rounded coordinates the user chose to share.

## Hosting
- GitHub Pages via a custom Actions workflow (`.github/workflows/deploy.yml`).
- Custom domain `skypassalert.com` (apex), with `www` redirecting to it and HTTPS enforced.
- Limits: published site under 1 GB, soft bandwidth limit of 100 GB/month, deploys under 10 min. Custom workflows have no build-frequency cap.
