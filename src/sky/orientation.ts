// Phone motion sensors → a sky camera in true-north ENU.
// Learn: docs/learn/11-compass.md
//
// The W3C DeviceOrientation angles (alpha, beta, gamma) describe the phone as
// intrinsic Z-X'-Y'' rotations: R = Rz(α)·Rx(β)·Ry(γ), mapping phone axes
// (x right, y towards the top edge, z out of the screen) into the Earth frame
// (x east, y north, z up). The back camera looks along the phone's −z.
//
// Two corrections make it point at the real sky:
// 1. Declination. Compasses find *magnetic* north (≈13° east of true north in
//    Fremont). We rotate by the WMM2025 declination.
// 2. Calibration. Magnetometers are disturbed by cars, railings and phone
//    cases. Lining up the Moon (or a bright star) once gives a heading offset
//    that cancels the error for the session.
import type { CameraBasis, V3 } from './projection.ts'

const D = Math.PI / 180

/** Columns of R = Rz(α)Rx(β)Ry(γ): where the phone's x, y, z axes point in the world. */
export function deviceAxes(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): { x: V3; y: V3; z: V3 } {
  const ca = Math.cos(alphaDeg * D)
  const sa = Math.sin(alphaDeg * D)
  const cb = Math.cos(betaDeg * D)
  const sb = Math.sin(betaDeg * D)
  const cg = Math.cos(gammaDeg * D)
  const sg = Math.sin(gammaDeg * D)
  return {
    x: [ca * cg - sa * sb * sg, cg * sa + ca * sb * sg, -cb * sg],
    y: [-cb * sa, ca * cb, sb],
    z: [cg * sa * sb + ca * sg, sa * sg - ca * cg * sb, cb * cg],
  }
}

/** Rotate an ENU vector about the vertical by `deg` (positive = clockwise seen from above, i.e. towards east). */
export function yaw(v: V3, deg: number): V3 {
  const c = Math.cos(deg * D)
  const s = Math.sin(deg * D)
  return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]]
}

/**
 * Camera basis for the back camera, given absolute-to-*magnetic*-north angles,
 * the screen's rotation (0, 90, 180, 270) and a heading correction in degrees
 * (declination + calibration) to apply clockwise.
 */
export function cameraFromDevice(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
  headingCorrectionDeg: number,
): CameraBasis {
  const { x, y, z } = deviceAxes(alphaDeg, betaDeg, gammaDeg)
  // Screen axes in phone coordinates for portrait/landscape.
  const c = Math.cos(screenAngleDeg * D)
  const s = Math.sin(screenAngleDeg * D)
  const right: V3 = [x[0] * c - y[0] * s, x[1] * c - y[1] * s, x[2] * c - y[2] * s]
  const up: V3 = [x[0] * s + y[0] * c, x[1] * s + y[1] * c, x[2] * s + y[2] * c]
  const forward: V3 = [-z[0], -z[1], -z[2]]
  return {
    right: yaw(right, headingCorrectionDeg),
    up: yaw(up, headingCorrectionDeg),
    forward: yaw(forward, headingCorrectionDeg),
  }
}

/** Azimuth (degrees, magnetic) of the back camera computed from relative alpha/beta/gamma. */
export function forwardAzimuth(alphaDeg: number, betaDeg: number, gammaDeg: number): number {
  const z = deviceAxes(alphaDeg, betaDeg, gammaDeg).z
  const f: V3 = [-z[0], -z[1], -z[2]]
  return (Math.atan2(f[0], f[1]) / D + 360) % 360
}

/** Exponential smoothing of a camera basis, re-orthonormalised. */
export function smoothBasis(prev: CameraBasis | null, next: CameraBasis, k: number): CameraBasis {
  if (!prev) return next
  const mix = (a: V3, b: V3): V3 => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]
  const n = (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  }
  const forward = n(mix(prev.forward, next.forward))
  const upRaw = mix(prev.up, next.up)
  const right = n([
    forward[1] * upRaw[2] - forward[2] * upRaw[1],
    forward[2] * upRaw[0] - forward[0] * upRaw[2],
    forward[0] * upRaw[1] - forward[1] * upRaw[0],
  ])
  const up: V3 = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ]
  // cross(forward, up) gives -right in a right-handed screen frame; fix orientation.
  return { right: [-right[0], -right[1], -right[2]], up: [-up[0], -up[1], -up[2]], forward }
}
