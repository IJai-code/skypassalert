// Greenwich Mean Sidereal Time: how far Earth has turned relative to the
// stars. SGP4 positions are in TEME, whose x-axis points at the mean equinox,
// so rotating by GMST takes them into the Earth-fixed frame.
// Learn: docs/learn/01-time.md#gmst
//
// We use the IAU-1982 expression on purpose: TEME is *defined* with it
// (Vallado et al. 2006, "Revisiting Spacetrack Report #3", §4). Using a newer
// Earth-rotation model would be more "modern" and less correct here.
import { DEG, TWO_PI } from '../math/constants.ts'
import { wrapTwoPi } from '../math/vec.ts'

/** GMST in radians for a Julian date on the UT1 scale. */
export function gmst82(jdUt1: number): number {
  const t = (jdUt1 - 2_451_545.0) / 36_525
  // Seconds of sidereal time.
  const seconds =
    -6.2e-6 * t * t * t + 0.093104 * t * t + (876_600 * 3600 + 8_640_184.812866) * t + 67_310.54841
  // 1 second of time = 1/240 degree.
  return wrapTwoPi(((seconds * DEG) / 240) % TWO_PI)
}
