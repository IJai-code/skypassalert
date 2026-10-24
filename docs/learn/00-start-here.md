# Start here

This folder teaches the engine one idea at a time. Every chapter follows the same shape:

1. **The idea**: what problem this piece solves, in one paragraph.
2. **The equations**: every symbol defined, with units.
3. **Where it lives**: file paths and function names in `src/engine`.
4. **Worked example**: real numbers you can check by hand or with a lab.
5. **Failure modes**: how it goes wrong, and how big the error is.

Each engine source file starts with a header comment linking back to its chapter.

## Reading order
| # | Chapter | Question it answers | Phase |
|---|---|---|---|
| 01 | `01-time.md` | What time is it, really? UTC, UT1, TT, Julian dates, GMST. | 2 |
| 02 | `02-frames.md` | Where is the station relative to me? TEME → ECEF → geodetic → topocentric az/el. | 2 |
| 03 | `03-sun.md` | Where is the Sun, and is my sky dark enough? | 2 |
| 04 | `04-shadow.md` | Is the station in sunlight? Cylindrical vs conical shadow. | 2 |
| 05 | `05-passes.md` | When exactly does it rise, peak and set? Scanning and root-finding. | 2 |
| 06 | `06-brightness.md` | How bright will it look? Magnitude and phase angle. | 2 |
| 07 | `07-propagators.md` | Why an interface? The satellite.js adapter and how we validate it. | 2 |
| 08 | `08-sgp4.md` | Our own SGP4: drag, oblateness, and why deep space is refused. | 4 |
| 09 | `09-accuracy.md` | How wrong are we, and how do we know? Reference tests and field data. | 4/8 |

## Labs: "predict, then run"
Labs are small scripts run with `npm run lab:<name>`, added in Phase 2. Each one asks you to **write down a prediction first** (e.g. "how many seconds does GMST gain on solar time per day?"), then runs the code and shows the answer. Keep your predictions in `ENGINEERING_LOG.md`. The misses are the interesting part.

Planned labs:
- `lab:sidereal`: how fast does the sky turn compared with the clock?
- `lab:shadow`: when does the ISS enter Earth's shadow, and how much do the two shadow models disagree?
- `lab:pass`: find tonight's passes for a city by hand-stepping, then compare with the root-finder.
- `lab:age`: how much does a prediction drift as the orbital elements get older?

## Also useful
- `docs/GLOSSARY.md`: quick definitions.
- `docs/DECISIONS.md`: why we chose what we chose.
- `docs/ARCHITECTURE.md`: the big picture.
- Later: `docs/learn/interview-questions.md`, hard questions with answer outlines.
