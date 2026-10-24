# 03 · The Sun: is it dark enough?

Code: `src/engine/sun/sun.ts`, `src/engine/sky/sunEvents.ts`.

## The idea
A station is visible when **it** is in sunlight but **you** are in the dark. So we need the Sun's position twice: once for the shadow test (chapter 04) and once for the observer's sky.

## Equations (Astronomical Almanac low-precision Sun; stated 0.01° for 1950–2050)
With n = JD_TT − 2 451 545.0:
```
L = 280.460° + 0.985 647 4°·n        (mean longitude)
g = 357.528° + 0.985 600 3°·n        (mean anomaly)
λ = L + 1.915° sin g + 0.020° sin 2g (ecliptic longitude)
ε = 23.439° − 0.000 000 4°·n         (obliquity)
R = 1.000 14 − 0.016 71 cos g − 0.000 14 cos 2g   (au)
r_sun = R·(cos λ, cos ε sin λ, sin ε sin λ)
```
That vector is in the mean equator/equinox of date, which we treat as TEME (they differ by < 0.006°).

## Events
Sun altitude crossing these values, root-found to 1 s:

| Event | Sun altitude | Meaning for us |
|---|---|---|
| Sunset/sunrise | −0.833° | 34′ refraction + 16′ solar radius |
| Civil dusk | −6° | Our default "dark enough": bright stations stand out |
| Nautical dusk | −12° | Horizon fades |
| Astronomical dusk | −18° | Fully dark |

The tonight strip colors the evening by these, and `sunsetAzDeg` powers the cue "face where the sun went down".

## Worked example
Fremont, 2026-10-24: sunset **6:18 PM** toward azimuth ~254° (WSW), and dark enough (−6°) by **6:45 PM**. Tonight's Tiangong pass starts at azimuth 245°, 9° left of the sunset point, so the cue is "one fist to the left".

## Failure modes
- Measured vs Skyfield: Sun direction max **39″**, sunset times max **3 s**.
- Above about 60° latitude in summer, the Sun may never reach −6°. Events come back as `null`, and the UI must say "it doesn't get dark enough tonight", not crash.
