# SkyPassAlert

**Look up tonight.** Free, plain-language times for when the International Space Station and China's Tiangong station are visible from where you stand: when to step outside, which way to face, how high it climbs, how bright it is, how long it lasts.

https://skypassalert.com · **Status:** Phase 2, a live preview for Fremont, CA. Place search, Chinese and sharing arrive in v0.1. See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/STATUS.md](docs/STATUS.md).

- No app, no account, no ads, no cookies, no personal data. Geolocation, if you allow it, stays on your device.
- English and 简体中文 at launch.
- Open source, with a published accuracy report: [docs/accuracy/phase2.md](docs/accuracy/phase2.md). It is generated in CI against Skyfield; satellite positions agree to within 15 m.

## Develop
Requires Node 22+.

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run ci           # lint, format check, typecheck, tests, build, JS budget
npm run lighthouse   # Lighthouse CI against a production preview (needs Chrome)
npm run lab:seasons  # "predict, then run" labs: sidereal, shadow, pass, seasons
npm run accuracy     # compare the engine with validation/reference/reference.json
```

To regenerate the Skyfield reference locally: `python3 -m venv .venv && .venv/bin/pip install -r validation/requirements.txt && npm run reference`.

| Path | What |
|---|---|
| `src/engine/` | framework-free prediction math (time, frames, Sun/Moon/planets, shadow, passes) |
| `src/ui/`, `src/pages/` | the screen (design rules in [docs/DESIGN.md](docs/DESIGN.md)) |
| `validation/` | Skyfield reference generator for the accuracy harness |
| `public/data/`, `data/archive/` | orbital elements we serve, and every fetch we've archived |
| `src/` | React UI |
| `scripts/` | build-time generators and checks |
| `docs/` | product, architecture, decisions, roadmap, learning chapters, growth kit |

Start reading at [CLAUDE.md](CLAUDE.md), then [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/learn/00-start-here.md](docs/learn/00-start-here.md).

## Accuracy and safety
Predictions are estimates for sky-watching. They are not for safety-critical use. Every prediction will show how old its orbital data is.

## Data and credits
Orbital elements and Earth-orientation data: [CelesTrak](https://celestrak.org/). Planet elements: JPL. Fremont's coordinates: [GeoNames](https://www.geonames.org/) (CC BY 4.0). Full list: [ASSETS.md](ASSETS.md).

## How this was built
Designed and directed by Ishaan, a high-school student in Fremont, CA, who sets direction, reviews every change, and checks the predictions against real passes outdoors. Implemented with [Claude Code](https://claude.com/claude-code).

## License
[MIT](LICENSE)
