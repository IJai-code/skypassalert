# 02 · Frames: where is it, relative to me?

Code: `src/engine/frames/` (`frames.ts`, `observer.ts`, `precession.ts`).

## The idea
SGP4 says where the station is in **TEME**, an Earth-centred frame that doesn't spin with Earth. You stand on a spinning, slightly squashed Earth. Three steps get from one to the other:

```
TEME ──rotate by −GMST──▶ ECEF ──subtract observer, rotate to local──▶ South-East-Zenith ──▶ azimuth, elevation, range
```

## Equations
**1. TEME → ECEF (Earth-fixed).** Rotate about the z-axis by −θ, with θ = GMST:
```
x' =  cos θ · x + sin θ · y
y' = −sin θ · x + cos θ · y
z' =  z
```
*Neglected:* polar motion, the axis wobbling ~10 m on the ground. That costs us ≤ 15 m (measured; see below).

**2. Observer on the WGS-84 ellipsoid** (a = 6378.137 km, f = 1/298.257 223 563, e² = f(2 − f)):
`N = a / √(1 − e² sin²φ)`,
`r_obs = ((N + h) cos φ cos λ, (N + h) cos φ sin λ, (N(1 − e²) + h) sin φ)`.
Latitude φ is *geodetic*: perpendicular to the ellipsoid, i.e. "straight up" for a person.

**3. Local South-East-Zenith,** with d = r_sat − r_obs:
```
S =  sin φ cos λ · dx + sin φ sin λ · dy − cos φ · dz
E = −sin λ · dx + cos λ · dy
Z =  cos φ cos λ · dx + cos φ sin λ · dy + sin φ · dz
azimuth = atan2(E, −S)      elevation = asin(Z / |d|)      range = |d|
```

## Worked example (tonight's Tiangong peak, Fremont)
| Step | Value |
|---|---|
| r_TEME (km) | (3532.108, −4095.912, 4051.651) |
| rotate by −72.5298° → r_ECEF (km) | (−2846.606, −4598.817, 4051.651) |
| directly below it | 37.01° N, 121.76° W, 387 km up (~60 km south of Fremont) |
| Fremont r_obs (37.548° N, 121.989° W, 17 m) | (−2682.207, −4294.334, 3865.823) |
| look angles | **az 160.9° (SSE), el 80.2°, range 392.8 km** |

Heavens-Above lists the same peak as 80° SSE at 19:36:06.

## Directions in words
`describe.ts` turns azimuth into 16 compass words, and elevation into **fists**: a fist at arm's length is about 10°, so 9 stacked fists reach straight up. It works for kids and adults because fist size scales with arm length.

## Failure modes
- **Geocentric vs geodetic latitude:** up to 0.19° difference. Use the wrong one and "up" points wrong by that much.
- **Polar motion** (neglected): measured max 14.9 m total position error vs Skyfield, i.e. about 0.0006° at the ~1 000 km ranges of a low pass.
- **Refraction** (`refractionDeg`) lifts things near the horizon by ~0.5°. We compute geometric positions, and refraction is used only for sunset (the −0.833° convention).
