# 12 · Sky Camera: photographing the sky from a browser

Code: `src/photo/` (`detect.ts`, `sync.ts`, `stack.ts`, `stack.worker.ts`, `cameraControl.ts`, `targets.ts`), `src/ui/SkyStage.tsx`, `src/ui/CaptureResult.tsx`.

## What a web page can and can't do with a phone camera (checked Oct 2026)
- **It can:** show the rear camera live (`getUserMedia`), read its frames, and open the phone's own camera to take one photo (`<input type="file" capture>`).
- **On many Android phones (Chrome):** it can also set **manual exposure time, ISO, focus distance and zoom** through `MediaStreamTrack.applyConstraints`. `exposureTime` is in units of 100 µs.
- **On iPhone (Safari):** it **can't** set exposure, ISO or focus, and nothing on the web can drive the native Camera app's settings.

So Sky Camera does three things:
1. **Sets manual settings where the phone allows it.** It reports exactly what it set ("1/250 s · ISO 50 · focus ∞") or says "automatic exposure" honestly.
2. **Gets quality from computation instead: stacking.**
3. **Offers the native camera** for the best single shot on iPhone, with a target-specific recipe, then enhances and labels that photo.

## Sky Sync: making the drawing match the real sky
Phone compasses drift by degrees near cars and metal. With the camera on, twice a second we:
1. Shrink a video frame to 192 px wide.
2. Find bright compact blobs (8-connected components above a brightness threshold).
3. Turn each blob's pixel position back into a sky direction with the inverse projection (`unproject`).
4. Match each blob to the Moon, bright planets or the brightest named stars predicted for that direction. A big blob must match the Moon, and a point must match a planet or star.
5. Ignore anything below 6° elevation (street lights, windows).
6. Nudge the compass by half the measured azimuth error.

Within a second or two the overlay locks onto the real sky, and the app says "Synced to the Moon".

## Stacking ("lucky imaging")
Each frame = signal + random noise + a random blur from air turbulence.
1. **Score** every frame by the variance of its Laplacian, a standard sharpness measure: crisp edges give big second derivatives.
2. **Keep the sharpest ~60%.** Planetary imagers call this "lucky imaging".
3. **Align** each frame on the target's brightness-weighted centroid with sub-pixel bilinear resampling, which cancels hand shake.
4. **Average.** Noise is random, so averaging N frames cuts it by about √N, while the target adds up.

Station passes use **lighten stacking** instead: the per-pixel maximum across frames draws the moving dot as a continuous streak, like a long exposure, without over-exposing the sky.

## Enhancement, tuned per target
- Black and white points come from histogram percentiles, then a gamma curve.
- Unsharp masking on luminance: L + a·(L − blur(L)).
- The Moon also gets a wide-radius local-contrast pass, which is what makes craters and seas pop.

The result screen shows **one raw frame** when you press and hold, so the improvement is visible and honest. Processing happens on the phone; nothing is uploaded.

## Honest expectations
- **Moon:** great results with zoom.
- **Planets on a phone alone:** bright points (Jupiter's moons sometimes). Rings and bands need a telescope or binoculars, and the planet mode is built for phone-to-eyepiece.
- **Faint star fields:** on iPhone, Night mode on a tripod (the recipe says so).
