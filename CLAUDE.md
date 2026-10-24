# SkyPassAlert: guide for Claude Code sessions

**SkyPassAlert** (https://skypassalert.com), tagline "Look up tonight." It's a free static web app that tells anyone on Earth, in plain words, when the ISS and China's Tiangong station are visible from where they stand.

## Roles
- **Claude Code** writes all code, tests, docs, CI, translations, share assets and marketing copy.
- **Ishaan** (project owner, high-school freshman) directs, reviews and merges PRs, runs the human tasks, observes passes and presents the project. He writes no code. Write for a sharp reader: he knows React, TS, Tailwind, Vite, Godot, Blender and physics sims.
- **His parent** handles money, accounts, the domain/email, and posting in parent groups.
- `ENGINEERING_LOG.md` and `FIELD_LOG.md` are Ishaan's, in his own words. Never write entries in them.

## Non-negotiables
- **3-second rule.** Opening the site shows tonight's best pass for the saved or default place at the top, with zero taps.
- **Generic `Place`** (name, lat, lon, elevation, IANA tz). Fremont is a default preset only and is never hard-coded in logic.
- **Privacy.**
  - No backend, accounts, cookies, ads or third-party trackers.
  - Geolocation stays on the device.
  - No runtime requests except our own static files.
  - Analytics only after explicit approval and a human-created account.
- **Honesty.**
  - Never fabricate users, quotes, testimonials, endorsements or stats.
  - No "first" or "only" claims (competitors overlap; see `docs/MARKET.md`).
  - Every prediction shows data age and an uncertainty note.
- **Performance.**
  - Initial JS under 150 KB gzip (`npm run check:size`).
  - Lighthouse mobile ≥90 in all four categories.
  - Heavy math runs in a Web Worker.
- **Engine.**
  - `src/engine` is framework-free (ESLint enforces no React imports) and fully unit-tested.
  - Everything goes through the `Propagator` interface. The satellite.js adapter is TEMPORARY until our own SGP4 (Phase 4).
- **i18n.** en and zh-Hans. Mark new translations "needs native-speaker review" (`data-translation-status="needs-native-review"` or the string catalog flag) until a person confirms them.
- **Brand.** Dark night sky, one accent (amber `#FFC65C`), large type, calm and fun voice. Original SVG only. No SpaceX, Starlink, NASA or CMSA logos or insignia; names can be used descriptively. Fonts must be OFL or permissive, and are recorded in `ASSETS.md`.
- **CelesTrak.**
  - One request per group per run, at most every 2 h (we use 6 h).
  - `FORMAT=JSON` (OMM), never TLE.
  - Stop on any non-200 response, no retries, and tell a human.
- **Licenses.** Every third-party asset or data source is recorded in `ASSETS.md` (GeoNames is CC BY 4.0 and needs attribution in the footer).

## Guardrails
- Work only inside this folder. Never touch `~/.ssh`, env files or git config, never use sudo, and never install anything globally.
- Never touch DNS. Never ask for, print or store credentials or tokens.
- Never spend money, create accounts or post publicly. Prepare everything, and humans do it.
- Don't create a repo named `ijai-code.github.io`.
- If blocked twice on the same problem, stop and report.
- Decide and document (in `docs/DECISIONS.md`) rather than ask, unless money, accounts or public posting are involved.

## Process
- **One roadmap phase per session** (`docs/ROADMAP.md`). Phases 2+ each get:
  - A new branch and Conventional Commits.
  - A PR using `.github/pull_request_template.md`: What changed, Why, How it was tested, Read this first, Concepts introduced, What to try, Growth impact, Human tasks.
  - Before opening the PR: `npm run ci`, a Lighthouse run and a preview check.
  - Then STOP for Ishaan's review and merge.
- At the end of every phase, update `docs/STATUS.md` (done, next, human tasks pending, risks).
- Source files start with a header comment linking to their `docs/learn` chapter. Comments explain *why*. Keep functions small and names clear.

## Commands
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm run check:size` · `npm run lighthouse` · `npm run ci` (everything except Lighthouse)

## Where things are
| Need | File |
|---|---|
| Product, audience, brand, voice | `docs/PRODUCT.md` |
| Architecture, engine design, budgets, data pipeline | `docs/ARCHITECTURE.md` |
| Growth system and launch plan | `docs/GROWTH.md`, `docs/growth/` |
| Phases and acceptance criteria | `docs/ROADMAP.md` |
| Why we chose X | `docs/DECISIONS.md` |
| Where we are now | `docs/STATUS.md` |
| Competitors (sourced) | `docs/MARKET.md` |
| Learning chapters for Ishaan | `docs/learn/` |
| Third-party sources and licenses | `ASSETS.md` |
