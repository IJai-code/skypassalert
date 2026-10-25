// A camera looking at the sky: turning (azimuth, elevation) into screen
// pixels. One camera model serves the hero picture (fixed view) and Sky View
// (view driven by the phone's motion sensors).
// Learn: docs/learn/11-compass.md#projection
//
// World frame is local East-North-Up (ENU), true north. The camera is three
// orthonormal ENU vectors: right, up (top of the screen) and forward (out of
// the back of the phone).

export type V3 = [number, number, number]
export type CameraBasis = { right: V3; up: V3; forward: V3 }
export type Projection = 'rectilinear' | 'stereographic'

const D = Math.PI / 180

export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const norm3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** ENU unit vector for an azimuth/elevation in degrees. */
export function enu(azDeg: number, elDeg: number): V3 {
  const ce = Math.cos(elDeg * D)
  return [ce * Math.sin(azDeg * D), ce * Math.cos(azDeg * D), Math.sin(elDeg * D)]
}

/** Azimuth/elevation (degrees) of an ENU direction. */
export function azEl(v: V3): { azDeg: number; elDeg: number } {
  const az = Math.atan2(v[0], v[1]) / D
  return { azDeg: (az + 360) % 360, elDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D }
}

/** A level camera (no roll) looking at azimuth/elevation. */
export function basisLookingAt(azDeg: number, elDeg: number, rollDeg = 0): CameraBasis {
  const forward = enu(azDeg, elDeg)
  // Avoid the singularity straight up: use the azimuth's horizontal direction.
  const worldUp: V3 = Math.abs(elDeg) > 89.9 ? enu(azDeg + 180, 0) : [0, 0, 1]
  let right = norm3(cross3(forward, worldUp))
  let up = cross3(right, forward)
  if (rollDeg) {
    const c = Math.cos(rollDeg * D)
    const s = Math.sin(rollDeg * D)
    const r2: V3 = [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s]
    up = cross3(r2, forward)
    right = r2
  }
  return { right, up, forward }
}

export type Viewport = {
  width: number
  height: number
  vfovDeg: number
  projection: Projection
  /** Where the view's centre lands on screen (default: the middle). */
  cx?: number
  cy?: number
}

/**
 * Project a sky direction into the viewport. Returns null when it is behind
 * the camera. Rectilinear matches a phone camera (straight lines stay
 * straight); stereographic keeps wide views (> 100°) from stretching.
 */
export function project(
  v: V3,
  cam: CameraBasis,
  vp: Viewport,
): { x: number; y: number; z: number } | null {
  const x = dot3(v, cam.right)
  const y = dot3(v, cam.up)
  const z = dot3(v, cam.forward)
  const half = (vp.vfovDeg / 2) * D
  const cx = vp.cx ?? vp.width / 2
  const cy = vp.cy ?? vp.height / 2
  if (vp.projection === 'rectilinear') {
    if (z <= 0.01) return null
    const k = vp.height / 2 / Math.tan(half)
    return { x: cx + (x / z) * k, y: cy - (y / z) * k, z }
  }
  // Far behind the camera the stereographic projection runs off to infinity.
  if (z <= -0.6) return null
  const k = vp.height / 2 / (2 * Math.tan(half / 2))
  return {
    x: cx + ((2 * x) / (1 + z)) * k,
    y: cy - ((2 * y) / (1 + z)) * k,
    z,
  }
}

/** Degrees to turn right (+) / left (−) and tilt up (+) / down (−) to face a target. */
export function turnTo(cam: CameraBasis, target: V3): { turnDeg: number; tiltDeg: number } {
  const camAe = azEl(cam.forward)
  const t = azEl(target)
  let turn = t.azDeg - camAe.azDeg
  if (turn > 180) turn -= 360
  if (turn < -180) turn += 360
  return { turnDeg: turn, tiltDeg: t.elDeg - camAe.elDeg }
}

/** Inverse of `project` for the rectilinear camera: screen pixel → sky direction. */
export function unproject(px: number, py: number, cam: CameraBasis, vp: Viewport): V3 {
  const k = vp.height / 2 / Math.tan(((vp.vfovDeg / 2) * Math.PI) / 180)
  const x = (px - (vp.cx ?? vp.width / 2)) / k
  const y = -(py - (vp.cy ?? vp.height / 2)) / k
  return norm3([
    cam.forward[0] + x * cam.right[0] + y * cam.up[0],
    cam.forward[1] + x * cam.right[1] + y * cam.up[1],
    cam.forward[2] + x * cam.right[2] + y * cam.up[2],
  ])
}
