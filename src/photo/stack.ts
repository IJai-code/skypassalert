// Computational astrophotography in the browser: score frames for sharpness,
// align them on the target, stack, then enhance for the kind of object.
// Runs in a Web Worker (stack.worker.ts).
// Learn: docs/learn/12-sky-camera.md#stacking
//
// Why stacking works: sensor noise is random from frame to frame, the sky is
// not. Averaging N aligned frames keeps the signal and cuts noise by √N.
// "Lucky imaging": the atmosphere blurs each frame differently, so keeping
// only the sharpest frames beats averaging all of them.

export type ShotKind = 'moon' | 'planet' | 'stars' | 'trail'

export type Frame = { data: Uint8ClampedArray; width: number; height: number }

const lumaAt = (d: Uint8ClampedArray, p: number) =>
  0.2126 * d[p]! + 0.7152 * d[p + 1]! + 0.0722 * d[p + 2]!

/** Variance of the Laplacian: high for crisp edges, low for blur and shake. */
export function sharpness(f: Frame): number {
  const { data, width: w, height: h } = f
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const p = (y * w + x) * 4
      const lap =
        4 * lumaAt(data, p) -
        lumaAt(data, p - 4) -
        lumaAt(data, p + 4) -
        lumaAt(data, p - w * 4) -
        lumaAt(data, p + w * 4)
      sum += lap
      sum2 += lap * lap
      n++
    }
  }
  const mean = sum / Math.max(1, n)
  return sum2 / Math.max(1, n) - mean * mean
}

/** Brightness-weighted centre of the bright part of the frame (the target). */
export function brightCentroid(f: Frame): { x: number; y: number } | null {
  const { data, width: w, height: h } = f
  let max = 0
  for (let p = 0; p < data.length; p += 16) max = Math.max(max, lumaAt(data, p))
  const t = max * 0.5
  let sx = 0
  let sy = 0
  let s = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lumaAt(data, (y * w + x) * 4) - t
      if (v > 0) {
        sx += x * v
        sy += y * v
        s += v
      }
    }
  }
  return s > 0 ? { x: sx / s, y: sy / s } : null
}

/**
 * Stack frames into a float RGB image (0–255 range).
 * - moon / planet / stars: keep the sharpest `keep` share, align on the bright
 *   centroid (sub-pixel, bilinear), average.
 * - trail: per-pixel maximum ("lighten"), which draws a moving station as a
 *   continuous streak, like a long exposure, without blowing out the sky.
 */
export function stack(
  frames: readonly Frame[],
  kind: ShotKind,
  keep = 0.6,
): { rgb: Float32Array; width: number; height: number; used: number } {
  const first = frames[0]
  if (!first) throw new Error('stack: no frames')
  const { width: w, height: h } = first
  const rgb = new Float32Array(w * h * 3)

  if (kind === 'trail') {
    for (const f of frames) {
      for (let i = 0, p = 0; i < w * h; i++, p += 4) {
        const o = i * 3
        if (f.data[p]! > rgb[o]!) rgb[o] = f.data[p]!
        if (f.data[p + 1]! > rgb[o + 1]!) rgb[o + 1] = f.data[p + 1]!
        if (f.data[p + 2]! > rgb[o + 2]!) rgb[o + 2] = f.data[p + 2]!
      }
    }
    return { rgb, width: w, height: h, used: frames.length }
  }

  const ranked = frames
    .map((f) => ({ f, s: sharpness(f) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, Math.round(frames.length * keep)))
  const ref = brightCentroid(ranked[0]!.f) ?? { x: w / 2, y: h / 2 }
  const count = new Float32Array(w * h)

  for (const { f } of ranked) {
    const c = brightCentroid(f) ?? ref
    const dx = c.x - ref.x
    const dy = c.y - ref.y
    for (let y = 0; y < h; y++) {
      const sy = y + dy
      const y0 = Math.floor(sy)
      const fy = sy - y0
      if (y0 < 0 || y0 + 1 >= h) continue
      for (let x = 0; x < w; x++) {
        const sx = x + dx
        const x0 = Math.floor(sx)
        const fx = sx - x0
        if (x0 < 0 || x0 + 1 >= w) continue
        const p00 = (y0 * w + x0) * 4
        const p10 = p00 + 4
        const p01 = p00 + w * 4
        const p11 = p01 + 4
        const o = (y * w + x) * 3
        for (let c3 = 0; c3 < 3; c3++) {
          const v =
            f.data[p00 + c3]! * (1 - fx) * (1 - fy) +
            f.data[p10 + c3]! * fx * (1 - fy) +
            f.data[p01 + c3]! * (1 - fx) * fy +
            f.data[p11 + c3]! * fx * fy
          rgb[o + c3]! += v
        }
        count[y * w + x]! += 1
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    const n = count[i]! || 1
    rgb[i * 3]! /= n
    rgb[i * 3 + 1]! /= n
    rgb[i * 3 + 2]! /= n
  }
  return { rgb, width: w, height: h, used: ranked.length }
}

/** Separable box blur of one channel plane (fast stand-in for a Gaussian). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const k = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / k
      const add = Math.min(w - 1, x + r + 1)
      const sub = Math.max(0, x - r)
      acc += src[y * w + add]! - src[y * w + sub]!
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k
      const add = Math.min(h - 1, y + r + 1)
      const sub = Math.max(0, y - r)
      acc += tmp[add * w + x]! - tmp[sub * w + x]!
    }
  }
  return out
}

const TUNING: Record<
  ShotKind,
  { black: number; white: number; gamma: number; radius: number; amount: number; local: number }
> = {
  // Craters live in mid-tones: firm black point, gentle gamma, strong fine + local sharpening.
  moon: { black: 0.02, white: 0.9995, gamma: 0.92, radius: 1, amount: 1.1, local: 0.35 },
  planet: { black: 0.01, white: 0.9998, gamma: 1, radius: 1, amount: 0.9, local: 0 },
  stars: { black: 0.4, white: 0.9995, gamma: 0.8, radius: 1, amount: 0.35, local: 0 },
  trail: { black: 0.3, white: 0.9995, gamma: 0.85, radius: 1, amount: 0.25, local: 0 },
}

/** Levels, gamma and unsharp masking tuned per kind of shot → RGBA bytes. */
export function enhance(
  img: { rgb: Float32Array; width: number; height: number },
  kind: ShotKind,
): Uint8ClampedArray {
  const { rgb, width: w, height: h } = img
  const t = TUNING[kind]
  const n = w * h
  const lum = new Float32Array(n)
  for (let i = 0; i < n; i++)
    lum[i] = 0.2126 * rgb[i * 3]! + 0.7152 * rgb[i * 3 + 1]! + 0.0722 * rgb[i * 3 + 2]!

  // Percentile black/white points from a histogram.
  const hist = new Uint32Array(1024)
  for (let i = 0; i < n; i++) hist[Math.min(1023, Math.max(0, Math.round(lum[i]! * 4)))]!++
  const pct = (q: number) => {
    let acc = 0
    for (let b = 0; b < 1024; b++) {
      acc += hist[b]!
      if (acc >= q * n) return b / 4
    }
    return 255
  }
  const lo = pct(t.black)
  const hi = Math.max(lo + 8, pct(t.white))

  // Unsharp mask on luminance (fine detail, then optional local contrast).
  const fine = boxBlur(lum, w, h, t.radius)
  const local = t.local > 0 ? boxBlur(lum, w, h, 12) : null
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    let L = lum[i]! + t.amount * (lum[i]! - fine[i]!)
    if (local) L += t.local * (lum[i]! - local[i]!)
    const ratio = lum[i]! > 0.5 ? L / lum[i]! : 1
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, (rgb[i * 3 + c]! * ratio - lo) / (hi - lo))
      out[i * 4 + c] = 255 * Math.min(1, v) ** t.gamma
    }
    out[i * 4 + 3] = 255
  }
  return out
}
