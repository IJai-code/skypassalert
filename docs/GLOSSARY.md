# Glossary

Short definitions. Each one links to the `docs/learn` chapter where it's explained properly (chapters arrive in Phase 2).

| Term | Meaning |
|---|---|
| **Azimuth (az)** | Compass direction measured clockwise from true north: 0° N, 90° E, 180° S, 270° W. We show it as "NW" etc. |
| **Elevation (el) / altitude** | Angle above the horizon: 0° horizon, 90° straight overhead. |
| **Pass** | One trip of a satellite across your sky, from rise to set. A *visible* pass is the part where it's above the minimum elevation, sunlit, and your sky is dark. |
| **Rise / peak / set** | When the satellite crosses the minimum elevation going up, reaches its highest point, and crosses it going down. |
| **Magnitude (mag)** | Astronomical brightness scale. Lower is brighter. Venus is about −4, the brightest stars about 0, and the faintest naked-eye stars about +6. The ISS is often −2 to −4. |
| **TLE / OMM** | Two-Line Element set (legacy text format) and Orbit Mean-elements Message (CCSDS standard, which we use as JSON). Both describe a satellite's orbit at an *epoch*. |
| **Epoch** | The moment the orbital elements describe. Predictions get worse the further you are from it. |
| **SGP4** | Simplified General Perturbations 4. The standard model for propagating TLE/OMM elements, including drag and Earth's oblateness. |
| **TEME** | True Equator, Mean Equinox. The Earth-centered inertial frame SGP4 outputs in. |
| **ECEF** | Earth-Centered, Earth-Fixed. A frame that rotates with Earth (x through 0° lat/0° lon). |
| **Geodetic** | Latitude, longitude and height on the WGS-84 ellipsoid (what GPS gives you). |
| **Topocentric** | Coordinates as seen from the observer: azimuth, elevation, range. |
| **UTC / UT1 / TT** | UTC is civil time (with leap seconds). UT1 follows Earth's actual rotation (differs from UTC by under 0.9 s). TT is a smooth time scale for physics (TT ≈ TAI + 32.184 s). |
| **GMST** | Greenwich Mean Sidereal Time. Earth's rotation angle, used to turn TEME into ECEF. |
| **Umbra / penumbra** | Full and partial Earth shadow. A satellite fades as it crosses the penumbra. |
| **Civil twilight** | Sun between 0° and −6° below the horizon. We need the Sun below about −6° for a station to stand out. |
| **IANA time zone** | Named zone such as `America/Los_Angeles` that encodes all historical and DST offset rules. We never use fixed offsets. |
| **Root-finding** | Numerically solving f(t) = 0, e.g. "when does elevation − 10° = 0?" We use bracketing plus Brent's method. |
| **CelesTrak** | Free public source of orbital elements run by Dr. T.S. Kelso. We follow its usage policy strictly. |
