# Status

_Last updated: 2026-10-24, end of Phase 1._

## Done (Phase 1: Foundation)
- Public repo https://github.com/IJai-code/skypassalert (MIT).
- **Stack:**
  - Vite 8, React 19, TypeScript 6 (strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`), Tailwind 4.
  - Vitest 5 with Testing Library and axe-core.
  - ESLint 10 and Prettier.
  - Exact versions pinned.
- **Placeholder** at https://skypassalert.com:
  - Tagline, a labelled example prediction, and what the app will do.
  - A zh-Hans section, marked `needs-native-review`.
  - Footer with source link, contact address and disclaimer.
  - Original SVG logo, favicon, touch icon, and an animated pass arc (still for reduced-motion users).
- **CI** (`.github/workflows/ci.yml`): lint → format → typecheck → tests (incl. axe) → build → initial-JS budget (150 KB gzip) → Lighthouse CI (mobile, all four categories ≥ 0.9).
- **Deploy** (`.github/workflows/deploy.yml`): GitHub Actions → Pages. Custom domain `skypassalert.com`, HTTPS enforced.
- **Numbers at the end of Phase 1:**
  - Initial JS 68.9 KB gzip, of a 150 KB budget.
  - Local Lighthouse (mobile, 3 runs): 100/100/100/100.
- **Verified 2026-10-24:**
  - `dig`: apex has the 4 GitHub Pages A records; `www` CNAME → `ijai-code.github.io.`
  - `curl -I http://skypassalert.com` returns 301 → `https://skypassalert.com/`.
  - `https://skypassalert.com` returns 200.
  - `http://www.skypassalert.com` and `https://www.skypassalert.com` both return 301 → `https://skypassalert.com/`.
  - The certificate covers the apex and www and expires 2027-01-22. GitHub renews it automatically.
- **Docs:** CLAUDE.md, PRODUCT, ARCHITECTURE, GROWTH, ROADMAP, DECISIONS (D-001…D-008), MARKET (sourced), GLOSSARY, learn/00-start-here, growth/README, ASSETS, and the ENGINEERING_LOG and FIELD_LOG templates.

## Next (Phase 2: Engine core)
Branch `feat/engine-core`. One PR, then stop for review.
- `src/engine`:
  - time (JD, UTC/UT1/TT, GMST) and frames (TEME→ECEF→geodetic→topocentric).
  - Sun and darkness.
  - Cylindrical and conical shadow.
  - Pass finder (scan + Brent).
  - Magnitude model.
  - `Propagator` interface plus a TEMPORARY satellite.js adapter (OMM JSON).
- A Web Worker wrapper.
- Validation: a Python Skyfield/sgp4 reference generator in CI, with max and mean errors written to `docs/accuracy/`.
- Time-zone tests (DST, southern hemisphere, +05:45, Lord Howe).
- Learn chapters 01–07 and the first labs.

## Human tasks pending
| Who | Task | Why |
|---|---|---|
| Parent | In Porkbun → Email Forwarding for skypassalert.com, add `hello@skypassalert.com` → the inbox you choose. The forwarding MX records already exist; only the rule is needed. | The site footer links to this address. |
| Ishaan | Read, in order: `CLAUDE.md` → `docs/PRODUCT.md` → `docs/ROADMAP.md` → `docs/ARCHITECTURE.md` → `docs/learn/00-start-here.md`. Write your first `ENGINEERING_LOG.md` entry. | Context for reviewing Phase 2. |
| Ishaan | Open https://skypassalert.com on your phone and a parent's phone. Note anything that looks off. | First real-device check. |
| Ishaan (optional) | Repo → Settings → Rules: add a ruleset on `main` requiring a PR and the `Lint, typecheck, test, build, budget` and `Lighthouse` checks. Admins can bypass. | Phases 2+ go through PRs; this makes CI a merge gate. |

## Open Dependabot PRs
- **TypeScript 6.0.3 → 7.0.2** (dev-tooling group): CI fails. TS 7 is a major release; typescript-eslint and the build may not support it yet. **Don't merge.** Phase 2 will evaluate it, or close it and pin TS 6 until the ecosystem catches up.

## Risks and watch items
- **CelesTrak:**
  - It returns 403 for a repeat download within its 2 h update window and firewalls IPs with more than 50 errors in 2 h. GitHub runners share IPs.
  - Plan: one request per group per run, stop on non-200, soft-fail and show data age, open an issue after repeated failures (Phase 5).
- **TLE phase-out:** we use OMM JSON only (D-004).
- **Scheduled workflows** in public repos are disabled after 60 days without repo activity. The data commits (Phase 5) keep the repo active; this file gets a check each phase.
- **Calendar subscriptions:** Google refreshes about every 12–24 h (unofficial), and alarms in subscribed feeds may be dropped. To be tested on real devices in Phase 5; the one-off .ics is the alarm path.
- **Competitor overlap** (see MARKET.md): no "first" or "only" claims in public copy.
- **Tailwind sourcemap warning** at build (the plugin doesn't emit maps for generated CSS). Harmless; revisit if it becomes noisy.
