// Tiny 3-vector helpers. Tuples keep the hot loops allocation-light and readable.
// Learn: docs/learn/02-frames.md

export type Vec3 = readonly [number, number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a))

/** Angle between two vectors, radians, numerically stable near 0 and π. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const cross: Vec3 = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  return Math.atan2(norm(cross), dot(a, b))
}

/** Rotate about the z axis by angle θ (radians), right-handed (counter-clockwise seen from +z). */
export function rotateZ(v: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]
}

/** Rotate about the x axis by angle θ (radians). */
export function rotateX(v: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]
}

/** Wrap an angle into [0, 2π). */
export function wrapTwoPi(x: number): number {
  const r = x % (2 * Math.PI)
  return r < 0 ? r + 2 * Math.PI : r
}

/** Wrap degrees into [0, 360). */
export function wrap360(x: number): number {
  const r = x % 360
  return r < 0 ? r + 360 : r
}

/** Signed smallest difference a − b in degrees, in (−180, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  const d = wrap360(a - b)
  return d > 180 ? d - 360 : d
}
