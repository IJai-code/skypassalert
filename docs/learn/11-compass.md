# 11 · Compass and Sky View: pointing a phone at the real sky

Code: `src/engine/magnetic/wmm.ts`, `src/sky/orientation.ts`, `src/sky/projection.ts`, `src/sky/drawSky.ts`, `src/sky/useOrientation.ts`, `src/ui/SkyView.tsx`.

## The idea
To draw the sky "through" a phone, we need three things:
1. Where the phone points.
2. Where true north is.
3. A way to turn sky directions into screen pixels.

Each one has a trap.

## 1. Where the phone points (DeviceOrientation)
Browsers report three angles: α (around the vertical), β (tilt front/back) and γ (tilt sideways). The W3C spec defines them as intrinsic rotations, giving the rotation matrix

`R = Rz(α) · Rx(β) · Ry(γ)`

R maps phone axes (x right, y toward the top edge, z out of the screen) into Earth axes (x east, y north, z up). So:
- The back camera looks along **−R·ẑ**.
- The top of the screen is **R·ŷ**.

`deviceAxes()` writes out R's columns, and the tests check that a phone held upright facing north looks at the northern horizon.

**Platform differences:**
- **Android Chrome** sends `deviceorientationabsolute`, where α is measured from magnetic north.
- **iOS Safari** gives α from an arbitrary zero, plus `webkitCompassHeading`, the magnetic heading. We learn the offset between the two while the phone is held up (where the heading is reliable) and blend it in slowly so it doesn't jump.
- **iOS also requires a permission tap.** `DeviceOrientationEvent.requestPermission()` must run inside the click that opens Sky View.

## 2. True north (World Magnetic Model)
Compasses point to **magnetic** north. In Fremont that's ~**12.7° east** of true north (NOAA WMM2025), enough to point you at the wrong stars. We evaluate NOAA's World Magnetic Model:
- A degree-12 spherical-harmonic expansion of Earth's main field (90 Gauss coefficients plus their yearly change).
- Evaluated at the observer's geocentric radius and colatitude.
- Using Schmidt semi-normalised associated Legendre functions.

Then:
- D = atan2(Y, X) is the declination.
- True heading = magnetic heading + D.

The test runs all 100 of NOAA's official WMM2025 test points: D and I match to **0.01°**, and X, Y, Z to 0.1 nT.

## 3. Calibration with the Moon
Magnetometers are bent by cars, railings, phone cases and magnets. A one-tap fix:
1. Centre the Moon (or the brightest planet) in the circle.
2. We know its true azimuth from the engine, so the difference is the compass error, removed for the rest of the session.

That's the answer to "web compasses are 10–30° off": measure the error against the sky itself.

## 4. Sky directions → pixels
A camera is three ENU unit vectors (right, up, forward). For a sky direction v, take x = v·right, y = v·up, z = v·forward. Then:
- **Rectilinear** (like a phone camera; straight lines stay straight): `X = x/z`, `Y = y/z`, scaled by `(H/2)/tan(vfov/2)`. Sky View uses it so the drawing lines up with the camera feed. Phone main cameras cover roughly 65–70° vertically in portrait; a "match zoom" slider fixes the rest.
- **Stereographic** (`X = 2x/(1+z)`): keeps very wide views from stretching. The hero picture uses it at ~115° wide.

## What's drawn (`drawSky.ts`)
- Twilight colours interpolated from the real Sun altitude, with an afterglow toward where the Sun set.
- Stars from the Yale Bright Star Catalogue, precessed to today, coloured by B−V. They're hidden progressively as the sky brightens: a limiting magnitude from −1.5 in daylight to ~4.3 in a full suburban night.
- Pattern lines (Big Dipper, Orion, Cassiopeia, Summer Triangle).
- The Moon with its lit side toward the Sun.
- Planets.
- The horizon with 10° ticks and compass points.
- The pass with minute marks and a direction arrow.

## Failure modes
- **Compass drift:** handled by Moon/planet calibration.
- **Landscape orientation:** handled via `screen.orientation.angle` but less tested than portrait.
- **In-app browsers** (WeChat) may block motion or the camera. Sky View falls back to drag-to-look, which is always correct because it needs no sensors.
