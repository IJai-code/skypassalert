// A place on Earth. Everything location-specific in the app flows from this
// type; no city is ever special-cased in engine code.
// Learn: docs/learn/02-frames.md#observer

export type Place = {
  /** Stable id for URLs and storage, e.g. "fremont-ca-us". */
  id: string
  name: string
  latDeg: number
  lonDeg: number
  /** Height above the WGS-84 ellipsoid is approximated by elevation above sea level (≤ ~40 m geoid error in California). */
  elevationM: number
  /** IANA time zone, e.g. "America/Los_Angeles". Never a fixed offset. */
  timeZone: string
}
