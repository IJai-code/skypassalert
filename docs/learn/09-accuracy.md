# 09 · Accuracy: how wrong are we, and how do we know?

Code: `validation/generate_reference.py`, `src/engine/validation/accuracy.test.ts`, `src/engine/passes/heavens-above.test.ts`. Report: `docs/accuracy/phase2.md`.

## Two different questions
1. **Is our math right?** Given the same orbital elements, do we compute the same sky as a trusted, independent implementation?
2. **Is the prediction right?** Does the real station show up when and where we said?

Question 1 is answered in CI on every push. Question 2 needs people outside with stopwatches (Phase 8, FIELD_LOG.md).

## Question 1: the Skyfield harness
`generate_reference.py` uses **Skyfield** (a widely used astronomy library with full IAU/IERS machinery: nutation, polar motion, aberration) and **sgp4** (the Python port of Vallado's SGP4). With a fixed random seed it generates:
- 4 000 random (time, observer) cases for ISS and Tiangong
- 1 000 Sun, 1 000 Moon and 5 000 planet cases across 2026–2027
- 120 one-day rise/set searches and 300 sunsets

Vitest recomputes everything with our engine and writes max, mean and 95th-percentile errors. CI regenerates the reference from pinned versions on every push, and thresholds sit just above today's numbers, so a regression fails the build.

| Quantity | Max error |
|---|---|
| Satellite position (time + frames pipeline) | **14.9 m** |
| Rise/set at 10° | 0.27 s |
| Sun direction | 39″ |
| Sunset time | 3 s |
| Moon direction | 5.9′ |
| Planet direction | 4.6′ |
| Planet magnitude (when brighter than mag 2) | 0.26 mag |

(Full table: `docs/accuracy/phase2.md`.)

### The lesson in that first number
On the first run the satellite error was ~**60 m**, not 15. The cause was the *reference*: Skyfield's bundled Earth-rotation table is a prediction made when that release was built, and by October 2026 it was 0.136 s off the current IERS value. We now feed Skyfield the same IERS file as our engine (including polar motion), so the comparison measures math, not stale data. The remaining ~10–15 m is the polar motion we deliberately neglect (chapter 02). **Always check that the reference is right before trusting the difference.**

## An independent cross-check: Heavens-Above
Heavens-Above is a long-running, widely used predictor. For 15 Fremont passes in the week of 2026-10-24, including the 2026-11-01 DST change, our start, peak and end times match its published values **to within 2 seconds** (start and end) and peak elevations to 1°. The test is `heavens-above.test.ts`; the data is recorded with source and date.

## Question 2 (Phase 8)
Both Skyfield and we run SGP4. If the elements are a day old, or the ISS fired its engines yesterday, both are wrong together. Only observation catches that. The FIELD_LOG protocol records predicted vs observed times, and the archive of every element set we fetch (`data/archive/`) lets us replay "what we predicted then" against "what you saw".
