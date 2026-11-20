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

<a id="textures"></a>
## 1½. Painting Earth from data
The globe has no photos. Two textures are painted on the phone in a few milliseconds, each 2048 × 1024, longitude across and latitude down (equirectangular):
- **Surface:** the sea as a deep-blue gradient; the land from Natural Earth's outlines, coloured by latitude (ice near the poles, forests, dry belts near 25°).
- **Night:** red = city lights, one soft dot per city from GeoNames, brighter for bigger cities; green = 1 over the sea, so the shader knows where the Sun can glint off water.

The shader turns each pixel's hit point into latitude and longitude (a 3×3 rotation from your frame back to Earth-fixed), reads both textures, and mixes them by how much sunlight falls there: lights only on the night side, glint only on the day side.

> **Predict:** close to the ground the 2048-pixel texture has one texel per ~20 km, so a city becomes a big soft blob. Why does raising the light value to a power (`pow(r, 3.5)`) make the blobs look like points again? (Hint: a Gaussian to a power is a narrower Gaussian.)

<a id="timeline"></a>
## 2. Scroll is the clock
The top of Tonight is 3.8 screens tall, with a stage that sticks while you scroll through it. How far through you are is `p`, from 0 to 1:

| p | Beat | What moves |
|---|---|---|
| 0–0.12 | Orbit | the opening shot: you read the answer over Earth |
| 0.12–0.40 | Dive | the camera drops from orbit into your yard |
| 0.40–0.86 | The pass | the clock runs from start to end, **linearly** |
| 0.86–1 | Settle | nothing: the page continues |

Linear matters: a centimetre of scroll is always the same number of seconds, so the station's speed on the screen is its real speed on the sky.

The page scrolls the browser's normal way. The film *chases* the scroll: each frame it closes the gap by `1 − e^(−Δt/τ)` with τ = 0.12 s. That's an exponential follow. A flick of the thumb glides, but the film never runs ahead of you or on its own.

<a id="camera"></a>
## 3. The camera
**On the ground** the camera turns with the station, like your head would. Near the zenith the station's azimuth swings wildly while it barely moves on the sky, so the camera follows an *averaged* azimuth. Each moment is weighted by cos(elevation): high up, azimuth hardly counts.

**The opening shot** sits two Earth radii from the centre, a little behind your town, looking towards the Sun, tilted so Earth's top edge lands 42% of the way down the screen. **The dive** is the same path as a climb, run backwards. Height changes **exponentially**:

```
h = 1.7 m × (5,000 km / 1.7 m)^(s^0.55)
```

Every bit of scroll multiplies the height by the same factor: thousands of kilometres, then hundreds, then metres. It's the same reason zooming maps feel smooth. The view turns in three legs: down at Earth, out at the horizon you're dropping towards (so Earth's edge flattens in front of you), then up into your sky.

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

**Bloom.** The frame is drawn into an offscreen, anti-aliased buffer. Its bright parts are copied at half size, blurred across and down (twice, wider the second time), and added back on top. That's why city lights, the Sun and the station glow the way they do in a camera.

**On demand.** Apart from the opening shot's first 20 seconds (a short intro and a slow drift), the GPU draws a frame only when the scroll, the size or the data changes, so the film costs no battery while you read.

> **A bug worth knowing:** our first animation loop asked for the next frame twice per frame, once in `draw()` and once in `tick()`. Two became four, then eight… and in a few seconds the page froze. Find the fix in `Flight.tsx` and explain why one frame at a time can never pile up.

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
