# 14 · Wave Back: the station's view of you

Code:
- `src/engine/sky/subpoint.ts`, with tests.
- `src/ui/wave/`:
  - `drawGlobe.ts`: projection and shading.
  - `earth.ts`: coastlines and "above the North Pacific".
  - `station.ts`: the sentence.
  - `waveCard.ts`: the share image.
- Data: `public/data/earth-110m.json`, built by `scripts/build-earth.mjs`.

## The question it answers
"Why can I see a space station at 7:30 PM but not at midnight?" Because you only see it when **you are in the dark and it is in sunlight**. Wave Back draws both halves of that sentence on one picture.

## 1. The sub-satellite point
SGP4 gives the station's position in TEME (an Earth-centred frame that does not spin). To find the point on the ground underneath it:
1. **Rotate TEME into Earth-fixed coordinates (ECEF):** turn by −GMST about the pole. This is the same `temeToEcef` the pass finder uses (chapter 02).
2. **Convert ECEF into geodetic latitude, longitude and height** on the WGS-84 ellipsoid with `ecefToGeodetic` (Bowring's method plus two refinements).

CI compares the result with Skyfield's `wgs84.subpoint_of` on 4,000 random cases. The maximum difference is about 14 m, mostly from polar motion, which we neglect.

> **Predict:** how many degrees of ground does the ISS cross per minute? (Answer in `subpoint.test.ts`: about 3.8°, roughly 420 km a minute.)

## 2. Where the Sun is overhead
- **Subsolar point:** rotate the Sun's direction into ECEF the same way. Its latitude and longitude are the point on Earth with the Sun straight up.
- **Sun elevation anywhere:** at any other point, the Sun's elevation is `90° − (angle between the point and the subsolar point)`.
- **Shading:** that one formula shades the globe:
  - Above 0° is day.
  - Below −12° is full night.
  - In between is twilight, drawn with a faint warm band near the line.

> **Predict:** at noon UTC in early November, is the subsolar point east or west of Greenwich? (The Sun runs about 16 minutes fast then, so it is ~4° west. Check the test.)

## 3. Drawing Earth from above the station
We use the **vertical-perspective projection** (Snyder, *Map Projections: A Working Manual*, §23), the view a camera has from height *h* looking straight down.
- With *P* = distance from Earth's centre in Earth radii, a point at angular distance *c* from the centre of view lands at radius `k·sin c`, where `k = (P−1)/(P − cos c)`.
- It is visible only if `cos c > 1/P`. Past that it is over the curve of the Earth.
- We place the camera ~2,600 km up (*P* = 1.41) so the station's whole horizon fits, and centre the view on the station as you drag through time.

Night shading runs the projection **backwards**: for every 4×4 pixel block we find the ground point and its Sun elevation, then smooth the result up to screen size.

## 4. The station's horizon
From height *h* the station can see the ground out to an angle of `acos(R / (R + h))` from the point beneath it. That is about 20° (2,200 km) for 400 km. Everyone inside the dashed ring has the station above their horizon. They see it only if they're in the dark and it's sunlit.

## 5. The sentence
`waveSentence` combines four numbers:
- the station's height;
- where it is ("above the North Pacific Ocean, 150 km off Monterey", using Natural Earth sea polygons plus the nearest city of ≥ 50,000 people);
- its straight-line distance from you (ECEF difference);
- whether it is sunlit (conical shadow model, chapter 04) and whether your Sun is low enough.

## Failure modes
- **Coastlines at 1:110m scale are rough:** a point a few km offshore may read as "land". Fine for a picture of half a continent.
- **Polar polygons:** Antarctica's outline can smear along the limb when the view is near the South Pole (we clamp hidden points to the edge).
- **Large distances:** the city naming says "above open land" when the nearest big city is over 1,500 km away (Sahara, Siberia).
