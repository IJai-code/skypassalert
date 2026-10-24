# src/engine

Framework-free prediction math. It runs unchanged in the Web Worker (`src/worker/predict.worker.ts`), in Node (labs, and Phase 5 build-time pages) and in tests. ESLint blocks React imports here.

Entry point: `forecast()` in `predict.ts` (a week of passes, evenings, Moon and planets for a `Place`).

| Module | Responsibility | Chapter |
|---|---|---|
| `time/` | Julian dates, UTC↔TAI↔TT, UT1 from bundled IERS data, GMST (IAU 1982), IANA zones | 01 |
| `frames/` | TEME → ECEF → geodetic (WGS-84) → topocentric; precession for planets | 02, 10 |
| `sun/`, `sky/sunEvents.ts` | Solar position, sunset and twilight | 03 |
| `shadow/` | Cylindrical and conical Earth shadow | 04 |
| `passes/`, `math/roots.ts` | Scan + Brent root-finding for rise/peak/set and visibility edges | 05 |
| `sky/schedule.ts` | Evening vs before-dawn, scoring, bedtime filter | 05 |
| `brightness/` | Satellite magnitude (diffuse sphere, calibrated) | 06 |
| `propagate/` | `Propagator` interface; `satellitejs-adapter.ts` (**TEMPORARY**); `sgp4/` (ours, Phase 4) | 07 |
| `moon/`, `planets/`, `sky/tonight.ts` | Moon position and phase; naked-eye planets and magnitudes | 10 |
| `describe/` | Angles and magnitudes → words (compass, fists, brightness, relative to sunset) | 02, 06 |
| `validation/` | Accuracy harness vs Skyfield | 09 |

## Rules
- Pure functions, explicit units in names (`rangeKm`, `elDeg`, `jdUt1`).
- Every approximation is documented in code and in its chapter, with its measured size.
- Every module is tested against reference values (Skyfield/sgp4, Heavens-Above) or defining constants.
