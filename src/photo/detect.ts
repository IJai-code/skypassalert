// Find bright things (Moon, planets, bright stars) in a small camera frame.
// Used by Sky Sync to line the drawn sky up with the real one.
// Learn: docs/learn/12-sky-camera.md#sync

export type Blob = {
  /** Brightness-weighted centre, in frame pixels. */
  x: number
  y: number
  /** Pixel count above threshold (the Moon is big, planets are 1–4 px). */
  area: number
  /** Summed brightness above threshold. */
  flux: number
}

/** Rec. 709 luma of an RGBA buffer, 0–255. */
export function luminance(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.2126 * rgba[p]! + 0.7152 * rgba[p + 1]! + 0.0722 * rgba[p + 2]!
  }
  return out
}

/**
 * Bright compact sources: pixels well above the frame's background, grouped
 * into 8-connected blobs. Night frames are mostly dark, so a high absolute
 * floor plus a relative one rejects sensor noise and city glow.
 */
export function findBlobs(lum: Float32Array, w: number, h: number, maxBlobs = 8): Blob[] {
  let max = 0
  let sum = 0
  for (let i = 0; i < lum.length; i++) {
    const v = lum[i]!
    sum += v
    if (v > max) max = v
  }
  const mean = sum / lum.length
  const threshold = Math.max(70, mean + 0.55 * (max - mean))
  if (max < 70) return []

  const seen = new Uint8Array(lum.length)
  const blobs: Blob[] = []
  const stack: number[] = []
  for (let start = 0; start < lum.length; start++) {
    if (seen[start] || lum[start]! < threshold) continue
    let area = 0
    let flux = 0
    let sx = 0
    let sy = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const y = (i - x) / w
      const v = lum[i]! - threshold + 1
      area++
      flux += v
      sx += x * v
      sy += y * v
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (!seen[j] && lum[j]! >= threshold) {
            seen[j] = 1
            stack.push(j)
          }
        }
      }
    }
    blobs.push({ x: sx / flux, y: sy / flux, area, flux })
  }
  return blobs.sort((a, b) => b.flux - a.flux).slice(0, maxBlobs)
}
