# src/engine

Framework-free prediction math. It runs unchanged in a Web Worker, in Node build scripts (place pages, OG images, calendar feeds) and in tests. ESLint blocks React imports here.

**Status:** empty until Phase 2. Design: `docs/ARCHITECTURE.md#engine-design`. Learning chapters: `docs/learn/`.

## Planned modules (Phase 2)
| Module | Responsibility | Chapter |
|---|---|---|
| `time/` | Julian date, UTC↔UT1↔TT, GMST | 01 |
| `frames/` | TEME → ECEF → geodetic (WGS-84) → topocentric az/el/range | 02 |
| `sun/` | Solar position, observer Sun altitude, darkness test | 03 |
| `shadow/` | Cylindrical and conical (umbra/penumbra) shadow | 04 |
| `passes/` | Coarse scan + Brent root-finding for rise/peak/set and visibility edges | 05 |
| `brightness/` | Magnitude from standard magnitude, range and phase angle | 06 |
| `propagate/` | `Propagator` interface; `satellitejs-adapter.ts` (**TEMPORARY**); `sgp4/` (ours, Phase 4) | 07, 08 |
| `place.ts` | `Place` type: name, lat, lon, elevationM, timeZone (IANA) | n/a |

## Rules
- Pure functions, explicit units in names (`rangeKm`, `elevationDeg`, `jdUt1`).
- Every approximation is documented in code and in its chapter, with its error size.
- Every module is tested against reference values (Skyfield/sgp4) or published test vectors.
