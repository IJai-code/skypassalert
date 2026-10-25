# 13 · Sky Check: telling clouds from a broken app

Code: `src/photo/conditions.ts` (with tests), used by `src/ui/SkyStage.tsx`.

## The problem
You point at Venus, see nothing, and decide the app is wrong. Usually the sky is: clouds, haze, a tree, or twilight glare. So the app checks.

## The idea (borrowed from observatories)
Observatory cloud cameras count **how many of the stars that should be visible actually are**. We can do the same, because the app knows exactly what should be in the frame and where:
1. Every half second, take a small 192 px frame from the camera.
2. Project the Moon, the planets and the brightest stars into that frame, using the same camera model as the overlay (corrected by Sky Sync).
3. Find point sources: local maxima above the local background by more than about 6× the noise. The noise is estimated robustly from the median absolute residual.
4. If an object bright enough for a phone camera (magnitude ≤ 1) is predicted at a spot and a point source is there, **the sky is clear there**.

## When the expected object is missing, ask why
- **Too bright:** the Sun is above −4°. Everything is still where the app shows it.
- **Blocked:** lots of strong edges (Sobel gradient > 80) while you're looking low (< 25°). That's branches, rooftops or wires.
- **Cloudy:** none of the expected objects show and the frame is a smooth glow.
- **Not judged:** objects too faint for a phone camera (magnitude > 1) are never blamed on clouds. The camera just can't see them.

The last 6 verdicts are majority-voted so the label doesn't flicker.

## Why not a cloud-classifying neural network?
- A model would be megabytes to download, opaque about *why*, and slower on older phones.
- This method is tiny, works offline, keeps every frame on the phone, and can give a reason for each verdict, for example "Venus should be right here but the camera can't see it: clouds or haze".

## Failure modes
- Thin cirrus may let Venus through while hiding fainter stars: you get "Partly cloudy".
- City glow can look like haze.
- A street light near your target could be mistaken for it. Sky Sync and the 6° elevation floor keep this rare.
