# Assets, data and licenses

Every third-party asset, dataset or library that ships to users, or that our data is derived from, is listed here. If it isn't listed, it doesn't ship.

## In use
| Asset | Use | Source | License / terms | Attribution |
|---|---|---|---|---|
| SkyPassAlert logo, favicon, hero arc | Brand | Original, drawn in SVG code (`src/brand/`, `public/favicon.svg`) | MIT (this repo) | n/a |
| System fonts | UI text | The user's device | n/a (nothing shipped) | n/a |
| React, React DOM | UI runtime | https://react.dev | MIT | Bundled license comments |

## Planned (not yet shipped)
| Asset | Phase | Source | License / terms | Attribution required |
|---|---|---|---|---|
| Orbital elements (OMM JSON) | 2/5 | CelesTrak GP data, https://celestrak.org/NORAD/elements/ | Public data. Follow the usage policy: https://celestrak.org/usage-policy.php | Credit "Orbital data: CelesTrak" in the footer and on /how-it-works |
| satellite.js | 2 (TEMPORARY) | https://github.com/shashwatak/satellite-js | MIT | License kept in bundle |
| GeoNames cities + alternate names | 3 | https://download.geonames.org/export/dump/ | CC BY 4.0 | **Required:** "City data © GeoNames (CC BY 4.0)" with a link, in the footer |
| Noto Sans SC (subset) | 3 | https://fonts.google.com/noto/specimen/Noto+Sans+SC | SIL Open Font License 1.1 | OFL text included with the font file |
| QR code generator | 3 | to be chosen (MIT/ISC only) | n/a | n/a |
| Skyfield, sgp4 (Python, CI only) | 2 | https://rhodesmill.org/skyfield/, https://pypi.org/project/sgp4/ | MIT | Credited in the accuracy report |
| Vallado SGP4 reference | 4 | Vallado et al., "Revisiting Spacetrack Report #3" (AIAA 2006-6753) and published code | Published reference; port credited | Credited in code headers and docs |
| NASA imagery (if any) | n/a | images.nasa.gov | Public domain (no implied endorsement; no insignia) | Source recorded per image |

## Not allowed
- Logos, insignia or trademarks of NASA, CMSA, SpaceX, Starlink or any other organization. Names may be used descriptively in text.
- Fonts or images without a recorded permissive license.
