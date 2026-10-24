// Physical and geometric constants used across the engine.
// Learn: docs/learn/02-frames.md (WGS-84), docs/learn/04-shadow.md (Sun/Earth radii)

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI
export const TWO_PI = 2 * Math.PI

/** WGS-84 equatorial radius, km. */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137
/** WGS-84 flattening. */
export const EARTH_FLATTENING = 1 / 298.257223563
/** First eccentricity squared, e² = f(2 − f). */
export const EARTH_E2 = EARTH_FLATTENING * (2 - EARTH_FLATTENING)

/** IAU 2012 astronomical unit, km. */
export const AU_KM = 149_597_870.7
/** Nominal solar radius (IAU 2015 B3), km. */
export const SUN_RADIUS_KM = 695_700

export const MS_PER_DAY = 86_400_000
export const SECONDS_PER_DAY = 86_400
/** Julian date of the Unix epoch, 1970-01-01T00:00:00 UTC. */
export const JD_UNIX_EPOCH = 2_440_587.5
/** Julian date of J2000.0 (2000-01-01T12:00 TT). */
export const JD_J2000 = 2_451_545.0
/** Modified Julian date = JD − 2400000.5. */
export const MJD_OFFSET = 2_400_000.5
