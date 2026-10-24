# 04 · Shadow: is the station in sunlight?

Code: `src/engine/shadow/shadow.ts`. Lab: `npm run lab:shadow`.

## The idea
Stations don't shine; they reflect sunlight. After sunset you're in Earth's shadow, but a station 400 km up can still be in sunlight. Partway through a pass it may slide into the shadow too, and it **fades out in the middle of the sky**. People find that baffling unless told, so the app tells them.

## Two models
**Cylindrical:** Earth casts a tube of shadow of radius R⊕. The satellite at r is dark if it's behind Earth (r·ŝ < 0) and within the tube (|r − (r·ŝ)ŝ| < R⊕).

**Conical (what we use):** look *from the satellite* at two discs.
- The Sun's apparent radius: a = asin(R☉ / |r☉ − r|).
- Earth's apparent radius: b = asin(R⊕ / |r|).
- Their separation c is the angle between (r☉ − r) and (−r).

Then:
- c ≥ a + b → fully lit (1)
- c ≤ b − a → umbra (0)
- otherwise the visible fraction is 1 − A/(πa²), where A is the circle-overlap area
  `A = a²·acos((c² + a² − b²)/2ca) + b²·acos((c² + b² − a²)/2cb) − ½√((−c+a+b)(c+a−b)(c−a+b)(c+a+b))`.

We call the station visible while ≥ 50% of the solar disc shows, and the brightness model dims it by −2.5·log₁₀(fraction).

## Worked example (tonight, Tiangong)
From the shadow lab:
- The conical model starts dimming at 7:36:52 PM and is fully dark at 7:37:01 PM: an **8.5 s fade** (the penumbra).
- The cylinder model switches off at 7:36:56 PM, within 0.1 s of the fade's midpoint.
- Heavens-Above lists the pass ending at 7:36:56 PM at 45°. Our end time matches to the second.

## Failure modes
- Earth isn't a sphere, and its atmosphere bends and absorbs light at the edge. Both shift shadow entry by a few seconds. We use the bare equatorial radius and document it. Phase 8 field observations will tell us whether to add an atmosphere margin.
