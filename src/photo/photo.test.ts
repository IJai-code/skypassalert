// @vitest-environment node
import { findBlobs, luminance } from './detect.ts'
import { brightCentroid, enhance, sharpness, stack, type Frame } from './stack.ts'

/** A synthetic night frame: dark noisy sky with a bright disc ("Moon") and a dot ("planet"). */
function frame(
  w: number,
  h: number,
  moon: { x: number; y: number; r: number },
  seed: number,
  blur = 0,
): Frame {
  const data = new Uint8ClampedArray(w * h * 4)
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - moon.x, y - moon.y)
      const edge =
        blur > 0 ? Math.min(1, Math.max(0, (moon.r + blur - d) / (2 * blur))) : d <= moon.r ? 1 : 0
      // Crater pattern so sharpness has something to measure.
      const crater = (Math.sin(x * 0.9) * Math.cos(y * 0.7) > 0.6 ? 0.75 : 1) * (blur > 0 ? 0.9 : 1)
      const planet = Math.hypot(x - 10, y - 10) < 1.2 ? 220 : 0
      const v = Math.min(255, 12 + rand() * 18 + edge * 210 * crater + planet)
      const p = (y * w + x) * 4
      data[p] = v
      data[p + 1] = v
      data[p + 2] = v * 0.95
      data[p + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

describe('finding bright objects', () => {
  it('finds the Moon (big) and a planet (tiny), brightest first', () => {
    const f = frame(96, 64, { x: 60, y: 30, r: 9 }, 1)
    const blobs = findBlobs(luminance(f.data, 96, 64), 96, 64)
    expect(blobs.length).toBeGreaterThanOrEqual(2)
    expect(blobs[0]!.x).toBeCloseTo(60, 0)
    expect(blobs[0]!.y).toBeCloseTo(30, 0)
    expect(blobs[0]!.area).toBeGreaterThan(100)
    expect(blobs.some((b) => Math.hypot(b.x - 10, b.y - 10) < 1.5)).toBe(true)
  })
  it('finds nothing in an empty dark sky', () => {
    const data = new Uint8ClampedArray(64 * 64 * 4).fill(20)
    expect(findBlobs(luminance(data, 64, 64), 64, 64)).toEqual([])
  })
})

describe('stacking', () => {
  it('scores a sharp frame above a blurred one', () => {
    expect(sharpness(frame(80, 80, { x: 40, y: 40, r: 20 }, 2))).toBeGreaterThan(
      sharpness(frame(80, 80, { x: 40, y: 40, r: 20 }, 2, 3)),
    )
  })
  it('aligns shaky frames on the target and reduces noise', () => {
    const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      frame(80, 80, { x: 40 + ((i * 3) % 5) - 2, y: 40 + ((i * 7) % 5) - 2, r: 18 }, 10 + i),
    )
    const out = stack(frames, 'moon', 1)
    // The stacked target sits where the reference frame's target is.
    const ref = brightCentroid(frames.reduce((a, f) => (sharpness(f) > sharpness(a) ? f : a)))!
    const rgba = new Uint8ClampedArray(80 * 80 * 4)
    for (let i = 0; i < 80 * 80; i++) {
      rgba[i * 4] = out.rgb[i * 3]!
      rgba[i * 4 + 1] = out.rgb[i * 3 + 1]!
      rgba[i * 4 + 2] = out.rgb[i * 3 + 2]!
    }
    const c = brightCentroid({ data: rgba, width: 80, height: 80 })!
    expect(Math.hypot(c.x - ref.x, c.y - ref.y)).toBeLessThan(1)
    // Background noise (std dev in an empty corner) drops after stacking.
    const sd = (get: (i: number) => number) => {
      const v: number[] = []
      for (let y = 60; y < 78; y++) for (let x = 60; x < 78; x++) v.push(get(y * 80 + x))
      const m = v.reduce((a, b) => a + b, 0) / v.length
      return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
    }
    expect(sd((i) => out.rgb[i * 3]!)).toBeLessThan(sd((i) => frames[0]!.data[i * 4]!) * 0.6)
  })
  it('lighten-stacks a moving dot into a trail', () => {
    const frames = [0, 1, 2, 3, 4].map((i) => {
      const data = new Uint8ClampedArray(50 * 10 * 4).fill(10)
      const p = (5 * 50 + 5 + i * 8) * 4
      data[p] = data[p + 1] = data[p + 2] = 250
      return { data, width: 50, height: 10 }
    })
    const out = stack(frames, 'trail')
    const lit = [0, 1, 2, 3, 4].filter((i) => out.rgb[(5 * 50 + 5 + i * 8) * 3]! > 200)
    expect(lit).toHaveLength(5)
  })
  it('enhancement stretches the range to full black and white', () => {
    const f = frame(64, 64, { x: 32, y: 32, r: 14 }, 3)
    const out = enhance(stack([f], 'moon', 1), 'moon')
    let min = 255
    let max = 0
    for (let i = 0; i < out.length; i += 4) {
      min = Math.min(min, out[i]!)
      max = Math.max(max, out[i]!)
    }
    expect(min).toBeLessThan(10)
    expect(max).toBeGreaterThan(245)
  })
})
