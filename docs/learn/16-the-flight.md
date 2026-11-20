# 16 · The Flight: a 3D film you scroll

Code:
- `src/ui/flight/world.ts`: one frame for everything (your yard, the station, the Sun, Earth).
- `src/ui/flight/camera.ts`: where the camera stands and looks, and the climb to orbit.
- `src/ui/flight/timeline.ts`: scroll position → beat, film time, height.
- `src/ui/flight/film.ts`: what to draw and label at each moment.
- `src/ui/flight/shaders.ts` and `renderer.ts`: the GPU side.
- `src/ui/flight/FlightStage.tsx` and `Flight.tsx`: the page, the rail, the fallbacks.
- Tests: `flight.test.ts`, `FlightStage.test.tsx`.

## The question it answers
"Where will it be, and why can I see it at all?" The first half you've seen as a chart. The second is easier to *show*: rise up until you can see your town and the station at once, one in shadow and one in sunlight.

<a id="world"></a>
## 1. One world, in kilometres
Game engines put everything in one scene; so do we. The scene is your **east-north-up** frame (chapter 02):
- x points east, y north, z straight up;
- you stand at the origin;
- Earth's centre is at (0, 0, −R), where R ≈ 6,370 km is your distance from it.

Everything else is converted into this frame on the CPU, in float64:
- **The station on its pass:** direction × distance, `enu(az, el) × range`, from the predicted track.
- **The station from orbit:** its latitude, longitude and height, converted with `geodeticToEcef`, then rotated into your frame.

These two routes to the same object must agree. The test checks they do, to within 5 km.

> **Predict:** why can't we just use the second route everywhere? (Hint: the track has samples every few seconds with the exact az/el the pass finder solved for; the orbit samples are every 30 s.)

<a id="timeline"></a>
## 2. Scroll is the clock
The top of Tonight is 3.2 screens tall, with a stage that sticks while you scroll through it. How far through you are is `p`, from 0 to 1:

| p | Beat | What moves |
|---|---|---|
| 0–0.08 | Tonight | nothing: you read the answer |
| 0.08–0.52 | The pass | the clock runs from start to end, **linearly** |
| 0.52–0.84 | Lift-off | the camera climbs |
| 0.84–1 | Settle | nothing: the page continues |

Linear matters: a centimetre of scroll is always the same number of seconds, so the station's speed on the screen is its real speed on the sky.

The page scrolls the browser's normal way. The film *chases* the scroll: each frame it closes the gap by `1 − e^(−Δt/τ)` with τ = 0.12 s. That's an exponential follow. A flick of the thumb glides, but the film never runs ahead of you or on its own.

<a id="camera"></a>
## 3. The camera
**On the ground** the camera turns with the station, like your head would. Near the zenith the station's azimuth swings wildly while it barely moves on the sky, so the camera follows an *averaged* azimuth. Each moment is weighted by cos(elevation): high up, azimuth hardly counts.

**The climb** is the fun part. Height grows **exponentially**:

```
h = 1.7 m × (5,000 km / 1.7 m)^(s^0.55)
```

Every bit of scroll multiplies the height by the same factor: metres, then kilometres, then hundreds of kilometres. It's the same reason zooming maps feel smooth. On the way up the camera looks along the fixed line from your yard to the station, then turns down to look at you both.

> **Predict:** we first aimed the climbing camera at the station *from the camera's current position*. A test caught a 5° jump in one step. At what height did it happen? (Answer in `camera.ts`: when the camera rose past the station's own height, ~420 km.)

<a id="gpu"></a>
## 4. The GPU side
One fragment shader traces a ray for every pixel. It asks one question: does this ray hit Earth?

```
b = o·d,   c = |o|² − R²,   hit if b² − c ≥ 0
```

There's a trap. In the yard, |o|² ≈ 4×10⁷ km² and R² is almost the same number. Float32 keeps about 7 digits, so their difference (which should be 2Rh ≈ 21.7 km²) comes out as noise, and the horizon wobbles. The fix is to never subtract them: we already know your height h on the CPU, so we pass it in and use **c = h(2R + h)**. Same maths, no cancellation.

The same formula draws the horizon line everywhere. The grazing ray has elevation −√c/|o|:
- in the yard that's the familiar dip √(2h/R) = 0.04°;
- from orbit, it's Earth's curved edge.

Everything else is ordinary graphics:
- **stars:** points, sized and faded by magnitude against how dark the sky is (chapter 10);
- **hairlines:** coastlines, the orbit (amber in sunlight, grey in shadow), the line of sight;
- **the pass:** a ribbon pushed sideways on the screen, so it's 3 px wide whether it's 400 km away or 5,000.

There's no depth buffer. Earth hides things analytically: the same ray test, cut off at the object's distance.

**On demand.** Nothing animates by itself. The GPU draws a frame only when the scroll, the size or the data changes, which is why the film costs no battery while you read.

## 5. Why you can see it
From orbit, the picture shows what chapter 04 proved: after sunset you're on the night side, but 420 km up the station is still in sunlight. Watch the orbit line turn from amber to grey: that's the station entering Earth's shadow, and the moment it vanishes from your sky.

## Failure modes
- **No WebGL2, or a low-memory phone:** you get the still 2D picture and a normal page.
- **The GPU won't start or loses its context:** the 2D picture takes over and still scrubs with the scroll.
- **Reduced motion:** the camera holds one wide frame and cuts to orbit instead of flying.

## Try it
- In `camera.ts`, change `ORBIT_ALT_KM` to 20,000. Scroll to the end: what happens to your town and the station?
- In `timeline.ts`, give the pass beat twice the scroll. Does the station feel slower? (It isn't. You're just scrolling more per second of film.)
- In `shaders.ts`, write `c` the naive way, `dot(oc, oc) - u_R * u_R`, run `npm run dev`, and look at the horizon from the yard. Why is it ragged now? And why does the same change in `hitEarth` (float64, on the CPU) still pass every test?
