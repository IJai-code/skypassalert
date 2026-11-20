// Small 3-vector helpers for the Flight, in float64 on the CPU. The GPU only
// ever sees the results (float32), so all the careful geometry happens here.
// Learn: docs/learn/16-the-flight.md
import type { V3 } from '../../sky/projection.ts'

export type { V3 }
/** Inputs may be read-only (the engine's vectors are). */
type In = readonly [number, number, number]

export const add = (a: In, b: In): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: In, b: In): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: In, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: In, b: In) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: In, b: In): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: In) => Math.hypot(a[0], a[1], a[2])
export const unit = (a: In): V3 => scale(a, 1 / (len(a) || 1))

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
/** Hermite ease: 0 → 1 with zero slope at both ends. */
export const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const smoothstep = (a: number, b: number, x: number) => smooth((x - a) / (b - a))

/**
 * Spherical interpolation between two unit vectors: turns at a steady rate
 * instead of cutting the corner like a straight lerp would.
 */
export function slerp(a: In, b: In, t: number): V3 {
  const c = Math.max(-1, Math.min(1, dot(a, b)))
  const angle = Math.acos(c)
  if (angle < 1e-6) return [a[0], a[1], a[2]]
  if (Math.PI - angle < 1e-6) {
    // Opposite vectors: any perpendicular path will do; pick one through "up".
    const mid = unit(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]))
    return t < 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, t * 2 - 1)
  }
  const s = Math.sin(angle)
  const wa = Math.sin((1 - t) * angle) / s
  const wb = Math.sin(t * angle) / s
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]
}

/** Shortest-way angle interpolation, degrees. */
export function lerpAngleDeg(a: number, b: number, t: number): number {
  let d = ((((b - a) % 360) + 540) % 360) - 180
  if (d === -180) d = 180
  return (((a + d * t) % 360) + 360) % 360
}
