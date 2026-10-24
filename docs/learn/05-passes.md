# 05 · Passes: when exactly does it rise, peak and set?

Code: `src/engine/passes/finder.ts`, `src/engine/math/roots.ts`, `src/engine/sky/schedule.ts`, `src/lib/state.ts`. Labs: `npm run lab:pass`, `npm run lab:seasons`.

## The idea
A visible pass is the stretch of time when **all three** hold:
1. elevation ≥ 10° (above trees and roofs), and
2. the station is in sunlight (chapter 04), and
3. the observer's Sun is ≤ −6° (chapter 03).

Each condition is a smooth function of time crossing a threshold. So: scan coarsely to *bracket* each crossing, then *root-find* it precisely.

## Algorithm
1. **Scan** elevation every 20 s. A station rising to 10° takes well over 20 s, so no real pass is skipped. One more safeguard: if three samples show a local maximum just below 10°, we maximise between them (Brent) to catch a pass that pokes above the line between samples.
2. **Root-find** each 10° crossing with **Brent's method** to 50 ms. Brent combines bisection's guarantee with inverse-quadratic interpolation's speed: typically ~10 evaluations instead of bisection's ~11+ for the same bracket, and far fewer for tighter tolerances.
3. Inside each above-10° interval, step every 2 s to find where "sunlit and dark sky" switches on or off. Root-find whichever condition flipped, so the reason is known: `rise`, `leaves-shadow`, `sky-darkens` / `sets`, `enters-shadow`, `sky-brightens`.
4. **Peak:** Brent maximisation of elevation over the visible part.
5. **Track:** 41 points for the sky map, each with its magnitude.

## Worked example (`lab:pass`, tonight's Tiangong)
```
7:32:00 PM    4.7°
7:33:00 PM   10.4°   ← crossed 10° in the minute before
7:35:00 PM   37.0°
7:36:00 PM   78.1°
7:37:00 PM   43.4°   ← in Earth's shadow by now
Root-finder: 7:32:56 PM (rise) → 7:36:56 PM (enters shadow), peak 80.2°
```
Heavens-Above: 19:32:56, peak 19:36:06 at 80°, end 19:36:56. Identical.

## Choosing "tonight's best" (`schedule.ts`, `state.ts`)
- **Periods:** evening (noon–22:00), late night, before dawn. Only evening and late-night passes can be "tonight". A 5 AM pass is listed for early risers, never as the headline.
- **Score:** `0.45·height + 0.35·brightness + 0.2·duration`, each scaled to 0–1. A pass must score ≥ 0.25 to be worth sending a family outside. The weights are a judgment call (DECISIONS D-016).
- **Bedtime filter:** passes must *end* before 9:30 PM (default).
- **Home-screen states:** look-now → get-ready (≤ 15 min) → tonight → just-ended → not-tonight, all pure functions of (forecast, now), with unit tests at real Fremont times.

## Seasons: why two stations matter
`lab:seasons` counts evenings with a good pass over 8 weeks (from the 2026-10-24 elements):

| Week of | ISS | Tiangong | Either |
|---|---|---|---|
| Oct 24 | 0/7 | 7/7 | 7/7 |
| Nov 7 | 5/7 | 1/7 | 6/7 |
| Nov 14 | 3/7 | 0/7 | 3/7 |
| Dec 5 | 0/7 | 0/7 | 0/7 |
| **8-week share** | **30%** | **38%** | **68%** |

Visible passes come in runs. The orbit plane turns relative to the Sun, so for a week or two passes fall at dusk, then move into daylight or the middle of the night. Two stations with different orbits fill each other's gaps. (Times this far ahead are approximate; the pattern is what this shows.)

## Failure modes
- Measured vs Skyfield over 878 rise/set events: **max 0.27 s**, mean 0.04 s.
- Elements age: a few seconds' error after a day, up to minutes after a week, and more after an unannounced ISS reboost. Hence the data-age note.
- Very short passes (< 10 s visible) are dropped on purpose.
