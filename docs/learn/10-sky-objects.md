# 10 · The Moon and planets: something to see every night

Code: `src/engine/moon/moon.ts`, `src/engine/planets/planets.ts`, `src/engine/frames/precession.ts`, `src/engine/sky/tonight.ts`.

## Why the station app computes planets
Stations aren't visible every evening (chapter 05: ~68% of evenings with both stations, ~30% with the ISS alone). On the other nights, "Jupiter is very bright in the east, highest around 11 PM" is still a reason to step outside, and it answers the "sky events near me" question people actually search for.

## Moon (Schlyter's method, ~1–2′)
Start from the orbit's elements of date (node N, inclination 5.1454°, perigee argument w, a = 60.27 Earth radii, e = 0.0549, mean anomaly M), solve Kepler's equation `E − e·sin E = M`, and get position in the orbit plane. Then add the largest perturbations by name:
- evection −1.274° sin(M − 2D)
- variation +0.658° sin 2D
- yearly equation −0.186° sin M☉
- 9 smaller longitude terms, 5 latitude terms and 2 distance terms

Here D is the Moon–Sun elongation. Finally rotate ecliptic → equator.
**Parallax matters:** the Moon is only ~60 Earth radii away, so where *you* stand shifts it by up to ~1°. Using the observer's position (chapter 02) handles that.

Phase: the illuminated fraction is (1 + cos i)/2, where i is the Sun–Moon–Earth angle.

## Planets (JPL "Approximate Positions", Table 1)
For each planet and for the Earth–Moon barycentre, JPL gives six Keplerian elements plus linear rates, fitted to 1800–2050. For time T (centuries TT from J2000):
1. Elements at T, then solve Kepler's equation, then the heliocentric position in the J2000 ecliptic.
2. Geocentric = planet − Earth, corrected once for **light time** (we see Saturn where it was ~80 minutes ago).
3. Ecliptic → equator (ε₀ = 23.43928°), then **precess** J2000 → date with the IAU 1976 angles ζ, z, θ. By 2026 that's a 0.36° shift, bigger than every other error here, so it's required.

**Magnitudes** use the Astronomical Almanac formulas in Meeus ch. 41, e.g. Venus `−4.40 + 5 log₁₀(rΔ) + 0.0009i + 0.000239i² − 0.00000065i³`. Saturn adds the ring term `−2.60 sin|B| + 1.25 sin²B`, where B is Earth's elevation above the ring plane, computed from Saturn's pole (α₀ = 40.589°, δ₀ = 83.537°). Adding it cut our Saturn error from ~0.4 to under 0.15 mag.

## Accuracy (vs Skyfield + JPL DE421)
- Moon direction: max 5.9′, mean 1.7′.
- Illuminated fraction: max 0.06 percentage points.
- Planet direction: max 4.6′.
- Magnitude: max 0.26 mag when the planet is brighter than mag 2. Mercury near inferior conjunction differs by up to 1 mag, but it's invisible then.

## Telling planets from stars
Planets shine steadily; stars twinkle. Planets are discs too small to see, but big enough that the atmosphere's shimmer averages out.
