# SkyPassAlert

**Look up tonight.** Free, plain-language times for when the International Space Station and China's Tiangong station are visible from where you stand: when to step outside, which way to face, how high it climbs, how bright it is, how long it lasts.

https://skypassalert.com · **Status:** Phase 1 (foundation). The site is a "coming soon" page; see [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/STATUS.md](docs/STATUS.md).

- No app, no account, no ads, no cookies, no personal data. Geolocation, if you allow it, stays on your device.
- English and 简体中文 at launch.
- Open source, with a published accuracy report (from Phase 4).

## Develop
Requires Node 22+.

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run ci           # lint, format check, typecheck, tests, build, JS budget
npm run lighthouse   # Lighthouse CI against a production preview (needs Chrome)
```

| Path | What |
|---|---|
| `src/engine/` | framework-free prediction math (Phase 2+) |
| `src/` | React UI |
| `scripts/` | build-time generators and checks |
| `docs/` | product, architecture, decisions, roadmap, learning chapters, growth kit |

Start reading at [CLAUDE.md](CLAUDE.md), then [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/learn/00-start-here.md](docs/learn/00-start-here.md).

## Accuracy and safety
Predictions are estimates for sky-watching. They are not for safety-critical use. Every prediction will show how old its orbital data is.

## Data and credits
Orbital elements will come from [CelesTrak](https://celestrak.org/), and city data from [GeoNames](https://www.geonames.org/) (CC BY 4.0). Full list: [ASSETS.md](ASSETS.md).

## How this was built
Designed and directed by Ishaan, a high-school student in Fremont, CA, who sets direction, reviews every change, and checks the predictions against real passes outdoors. Implemented with [Claude Code](https://claude.com/claude-code).

## License
[MIT](LICENSE)
