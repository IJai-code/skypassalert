# 01 · Time: what time is it, really?

Code: `src/engine/time/` (`julian.ts`, `scales.ts`, `sidereal.ts`, `zone.ts`). Lab: `npm run lab:sidereal`.

## The idea
A pass prediction needs **four different clocks**, and confusing them is the most common way to get a "right" calculation wrong:

| Scale | What it tracks | Used for |
|---|---|---|
| **UTC** | Civil time; what phones show (plus a time-zone offset) | Input/output, SGP4's time-since-epoch |
| **TAI / TT** | Atomic time, smooth. TT = TAI + 32.184 s | Sun, Moon, planet formulas |
| **UT1** | Earth's actual rotation angle | Turning the sky into "where is it from my backyard" |
| **Local time** | UTC + the zone's rules (DST!) | What we show people |

## Equations
- **Julian date** (days since noon, 1 Jan 4713 BC), from Unix milliseconds:
  `JD_UTC = ms / 86 400 000 + 2 440 587.5`
- **Leap seconds:** `TAI − UTC = ΔAT` (37 s since 2017-01-01, table in `scales.ts`), so `TT − UTC = ΔAT + 32.184 s = 69.184 s` today.
- **UT1:** `UT1 = UTC + ΔUT1`, where ΔUT1 (always within ±0.9 s) is *measured* by the IERS. We ship a daily table from CelesTrak's EOP file, refreshed daily by the Data workflow, and interpolate linearly (never across a leap-second jump).
- **GMST (IAU 1982)**, with `T = (JD_UT1 − 2 451 545.0) / 36 525`:
  `GMST[s] = 67 310.54841 + (876 600·3600 + 8 640 184.812866)·T + 0.093104·T² − 6.2×10⁻⁶·T³`,
  converted at 1 s = 1/240°. We use the 1982 model on purpose: SGP4's TEME frame is *defined* with it.

## Worked example
Tonight's Tiangong peak, 2026-10-25 02:36:06 UTC (7:36:06 PM in Fremont):

| Quantity | Value |
|---|---|
| JD (UTC) | 2 461 338.608 402 8 |
| JD (TT) = + 69.184 s | 2 461 338.609 203 5 |
| ΔUT1 (IERS, interpolated) | −0.048 1 s |
| JD (UT1) | 2 461 338.608 402 2 |
| GMST | **72.5298°** |

Check by hand: in one day GMST gains 360° + 0.9856°. That extra ≈ 360°/365.25 is why stars rise ~4 min earlier each night (`lab:sidereal`).

## Time zones
Local time always goes through IANA zones with `Intl.DateTimeFormat`, never fixed offsets (`zone.ts`).
- On 2026-11-01, Fremont's 1:30 AM happens twice; we pick the first.
- On 2027-03-14, 2:30 AM never happens; it maps to 3:30 AM PDT.
- Tests cover Kathmandu (+5:45), Lord Howe (+10:30/+11:00, a 30-minute DST) and Sydney (DST over New Year).

## Failure modes (and their size)
- **Stale ΔUT1.** We measured this one for real. Skyfield's bundled prediction for Oct 2026 was 0.136 s off the current IERS value, which by itself moved observers by **~60 m** (Earth's surface turns ~0.46 km/s at the equator). With the same IERS file on both sides, the difference fell to under 15 m. See `09-accuracy.md`.
- **Using UTC where TT belongs:** a 69 s error. Harmless for the Sun (0.0008°), but 0.6′ for the Moon.
- **Fixed offsets instead of zones:** pass times an hour off for a week after a DST change. That's a trust killer.
