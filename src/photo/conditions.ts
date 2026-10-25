// Sky Check: is the sky in front of the camera clear, cloudy, too bright, or
// blocked? Runs on the phone, a couple of times a second, on a small frame.
// Learn: docs/learn/13-sky-check.md
//
// The core idea is the one observatory cloud cameras use: we know exactly
// which bright objects *should* be in the frame and where (from the sky
// model and Sky Sync). If they show up, the sky is clear there. If they
// don't, the image's texture says why: a smooth, glowing frame is cloud; a
// busy, edge-heavy frame low in the sky is trees or buildings; a bright
// frame with the Sun up is daylight. Every verdict comes with a reason.
import { luminance } from './detect.ts'

export type Condition = 'clear' | 'partly' | 'cloudy' | 'bright' | 'blocked' | 'unknown'

/** Something the sky model says should be in this frame, at a pixel position. */
export type Expected = { name: string; x: number; y: number; magnitude: number }

export type FrameStats = {
  /** Median brightness 0–255 (sky background). */
  median: number
  /** Spread of the large-scale background (glowing cloud vs dark sky). */
  backgroundSpread: number
  /** Fraction of pixels on strong edges (branches, rooftops, wires). */
  edgeDensity: number
  /** Point-like sources found (stars, planets). */
  points: Array<{ x: number; y: number; strength: number }>
}

/** Box blur (separable) for the background estimate. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const k = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / k
      acc += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!
    }
  }
  return out
}

const median = (a: Float32Array | number[]) => {
  const s = Array.from(a).sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)] ?? 0
}

export function frameStats(rgba: Uint8ClampedArray, w: number, h: number): FrameStats {
  const lum = luminance(rgba, w, h)
  const bg = blur(lum, w, h, 6)
  const resid = new Float32Array(lum.length)
  for (let i = 0; i < lum.length; i++) resid[i] = lum[i]! - bg[i]!
  // Robust noise level: median absolute residual.
  const noise = Math.max(1.5, median(resid.map(Math.abs)) * 1.4826)

  // Point sources: local maxima well above the local background.
  const points: FrameStats['points'] = []
  const thr = Math.max(14, 6 * noise)
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x
      const v = resid[i]!
      if (v < thr) continue
      let peak = true
      for (let dy = -1; dy <= 1 && peak; dy++)
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && resid[i + dy * w + dx]! > v) peak = false
      if (peak) points.push({ x, y, strength: v })
    }
  }

  // Edges: Sobel magnitude, counted where clearly above noise.
  let edges = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        lum[i - w + 1]! +
        2 * lum[i + 1]! +
        lum[i + w + 1]! -
        lum[i - w - 1]! -
        2 * lum[i - 1]! -
        lum[i + w - 1]!
      const gy =
        lum[i + w - 1]! +
        2 * lum[i + w]! +
        lum[i + w + 1]! -
        lum[i - w - 1]! -
        2 * lum[i - w]! -
        lum[i - w + 1]!
      // Fixed threshold: texture inflates the noise estimate, which would hide branches.
      if (Math.hypot(gx, gy) > 80) edges++
    }
  }
  const bgVals = Array.from(bg)
  const m = bgVals.reduce((a, b) => a + b, 0) / bgVals.length
  const spread = Math.sqrt(bgVals.reduce((a, b) => a + (b - m) ** 2, 0) / bgVals.length)
  return {
    median: median(lum),
    backgroundSpread: spread,
    edgeDensity: edges / ((w - 2) * (h - 2)),
    points,
  }
}

export type Verdict = {
  condition: Condition
  /** Short, human reason shown under the chip. */
  reason: string
  /** For each expected object in frame: did the camera see it? */
  seen: Record<string, boolean>
}

/** A phone camera's video reliably shows objects brighter than about this. */
export const CAMERA_LIMIT_MAG = 1.0

export function judge(
  stats: FrameStats,
  expected: readonly Expected[],
  sunAltDeg: number,
  viewElDeg: number,
): Verdict {
  const seen: Record<string, boolean> = {}
  const checkable = expected.filter((e) => e.magnitude <= CAMERA_LIMIT_MAG)
  for (const e of checkable) {
    // Matched if any point source sits within ~4% of the frame of the predicted spot.
    seen[e.name] = stats.points.some((p) => Math.hypot(p.x - e.x, p.y - e.y) < 9)
  }
  if (sunAltDeg > -4) {
    return { condition: 'bright', reason: 'The sky is too bright for the camera right now', seen }
  }
  const matched = checkable.filter((e) => seen[e.name]).length
  const busy = stats.edgeDensity > 0.06
  const glowing = stats.median > 60 || stats.backgroundSpread > 14

  if (checkable.length) {
    if (matched === checkable.length) {
      return {
        condition: glowing ? 'partly' : 'clear',
        reason: `Clear here: the camera sees ${checkable.map((e) => e.name).join(' and ')}`,
        seen,
      }
    }
    if (matched > 0) return { condition: 'partly', reason: 'Some of the sky here is covered', seen }
    if (busy && viewElDeg < 25)
      return { condition: 'blocked', reason: 'Something is in the way: trees or buildings', seen }
    return {
      condition: 'cloudy',
      reason: `${checkable.map((e) => e.name).join(' and ')} should be right here but the camera can’t see ${checkable.length > 1 ? 'them' : 'it'}: clouds or haze`,
      seen,
    }
  }
  // Nothing bright enough to check against: fall back on texture and stars.
  if (busy && viewElDeg < 25)
    return { condition: 'blocked', reason: 'Something may be in the way: trees or buildings', seen }
  if (stats.points.length >= 3 && !glowing)
    return { condition: 'clear', reason: 'Clear here: stars are showing', seen }
  if (glowing && stats.points.length === 0)
    return { condition: 'cloudy', reason: 'The sky here looks hazy or cloudy', seen }
  return {
    condition: 'unknown',
    reason: 'Point at the Moon or a bright planet to check the sky',
    seen,
  }
}

/** Steady the verdict: the most common condition over the last few frames. */
export function settle(history: readonly Condition[]): Condition {
  const counts = new Map<Condition, number>()
  for (const c of history) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: Condition = 'unknown'
  let n = 0
  for (const [c, k] of counts) if (k > n) [best, n] = [c, k]
  return best
}
