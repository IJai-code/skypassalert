# Assets, data and licenses

Every third-party asset, dataset or library that ships to users, or that our data is derived from, is listed here. If it isn't listed, it doesn't ship.

## In use
| Asset | Use | Source | License / terms | Attribution |
|---|---|---|---|---|
| SkyPassAlert logo, favicon, hero arc | Brand | Original, drawn in SVG code (`src/brand/`, `public/favicon.svg`) | MIT (this repo) | n/a |
| System fonts | Body text | The user's device | n/a (nothing shipped) | n/a |
| Archivo (variable, subset) | Instrument readouts (`public/fonts/archivo-var.woff2`) | The Archivo Project Authors, https://github.com/Omnibus-Type/Archivo | SIL Open Font License 1.1 (`public/fonts/Archivo-OFL.txt`) | OFL text shipped alongside |
| React, React DOM | UI runtime | https://react.dev | MIT | Bundled license comments |
| satellite.js 7.1.0 | SGP4 propagation (TEMPORARY until Phase 4) | https://github.com/shashwatak/satellite-js | MIT | License kept in bundle |
| Orbital elements (OMM JSON) | `public/data/elements.json`, `data/archive/` | CelesTrak GP data, https://celestrak.org/NORAD/elements/ | Public data; we follow https://celestrak.org/usage-policy.php | "CelesTrak orbital data" in the site footer |
| Earth orientation (UT1 − UTC) | `src/engine/time/eop-data.json` | CelesTrak EOP file (IERS data), https://celestrak.org/SpaceData/ | Public data | Credited in docs/learn/01-time.md |
| Planetary elements | `src/engine/planets/planets.ts` | JPL Solar System Dynamics, "Approximate Positions of the Planets" (E. M. Standish), https://ssd.jpl.nasa.gov/planets/approx_pos.html | U.S. Government work | Credited in code and docs |
| Moon algorithm | `src/engine/moon/moon.ts` | Paul Schlyter, "How to compute planetary positions", https://stjarnhimlen.se/comp/ppcomp.html | Published method (reimplemented) | Credited in code |
| Bright stars | `src/engine/stars/bright-stars.json` (from `data/fixtures/bsc5-catalog.dat`) | Yale Bright Star Catalogue, 5th ed. (Hoffleit & Warren 1991), CDS catalog V/50, https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50 | Freely distributed astronomical catalogue (NASA ADC / CDS) | Credited in code, docs and site footer |
| World Magnetic Model 2025 | `src/engine/magnetic/wmm2025.json` (from `data/fixtures/WMM2025.COF`) | NOAA NCEI / British Geological Survey, https://www.ncei.noaa.gov/products/world-magnetic-model | U.S. Government work, public domain (17 U.S.C. 403 notice: not subject to copyright) | Credited in Sky View and docs |
| QR code SVG | `public/qr.svg` (pre-rendered at build time) | `qrcode` npm package (build-time only, not shipped) | MIT | n/a |
| Fremont coordinates | `src/presets.ts` | GeoNames (geonameId 5350734) | CC BY 4.0 | Footer + place picker |
| City search list | `public/data/cities.json` (built by `scripts/build-cities.mjs` from cities15000 + admin1CodesASCII) | GeoNames, https://download.geonames.org/export/dump/ | CC BY 4.0 | “City data © GeoNames (CC BY 4.0)” in the place picker and footer |
| Moon photo | `public/img/moon.webp` | NASA Goddard / LRO, images.nasa.gov GSFC_20171208_Archive_e000868 | NASA media: public domain, no endorsement implied | Credited on card |
| Saturn photo | `public/img/saturn.webp` | NASA/JPL/Space Science Institute (Cassini), PIA11613 | Public domain | Credited on card |
| Jupiter photo | `public/img/jupiter.webp` | NASA/JPL/Space Science Institute (Cassini), PIA04866 | Public domain | Credited on card |
| Mars photo | `public/img/mars.webp` | NASA/JPL/USGS (Viking), PIA00407 | Public domain | Credited on card |
| Venus photo | `public/img/venus.webp` | NASA/JPL-Caltech (Mariner 10), PIA23791 | Public domain | Credited on card |
| ISS photo | `public/img/iss.webp` | NASA, Expedition 56 crew, iss056e201248 | Public domain | Credited on card |
| Milky Way photo | `public/img/milkyway.webp` (cropped to remove a spacecraft window label) | NASA, ISS crew, iss074e0521637 | Public domain | Credited on card |

## Planned (not yet shipped)
| Asset | Phase | Source | License / terms | Attribution required |
|---|---|---|---|---|
| GeoNames cities + alternate names | 3 | https://download.geonames.org/export/dump/ | CC BY 4.0 | **Required:** "City data © GeoNames (CC BY 4.0)" with a link, in the footer |
| Noto Sans SC (subset) | 3 | https://fonts.google.com/noto/specimen/Noto+Sans+SC | SIL Open Font License 1.1 | OFL text included with the font file |
| QR code generator | 3 | to be chosen (MIT/ISC only) | n/a | n/a |
| Skyfield, sgp4, jplephem (Python, CI only) | 2 ✓ | https://rhodesmill.org/skyfield/, https://pypi.org/project/sgp4/ | MIT | Credited in the accuracy report |
| JPL DE421 ephemeris (CI only, not committed) | 2 ✓ | https://ssd.jpl.nasa.gov/ (downloaded by Skyfield) | U.S. Government work | Credited in the accuracy report |
| Heavens-Above pass values (test fixture, 15 rows, facts) | 2 ✓ | https://www.heavens-above.com/ | Facts recorded for a cross-check, with source and date | Named in the test and docs |
| Vallado SGP4 reference | 4 | Vallado et al., "Revisiting Spacetrack Report #3" (AIAA 2006-6753) and published code | Published reference; port credited | Credited in code headers and docs |
| NASA imagery (if any) | n/a | images.nasa.gov | Public domain (no implied endorsement; no insignia) | Source recorded per image |

## Not allowed
- Logos, insignia or trademarks of NASA, CMSA, SpaceX, Starlink or any other organization. Names may be used descriptively in text.
- Fonts or images without a recorded permissive license.
