// Julian dates. The engine's "currency" for time is Unix milliseconds (UTC),
// converted to Julian dates on each time scale only where the physics needs it.
// Learn: docs/learn/01-time.md
import { JD_UNIX_EPOCH, MJD_OFFSET, MS_PER_DAY } from '../math/constants.ts'

/** Julian date on the UTC scale for a Unix-millisecond instant. */
export function jdUtc(unixMs: number): number {
  return unixMs / MS_PER_DAY + JD_UNIX_EPOCH
}

/** Modified Julian date (UTC). */
export function mjdUtc(unixMs: number): number {
  return jdUtc(unixMs) - MJD_OFFSET
}

/** Inverse of jdUtc. */
export function unixMsFromJdUtc(jd: number): number {
  return (jd - JD_UNIX_EPOCH) * MS_PER_DAY
}

/** Julian centuries since J2000.0 for a Julian date on any scale. */
export function centuriesSinceJ2000(jd: number): number {
  return (jd - 2_451_545.0) / 36_525
}
