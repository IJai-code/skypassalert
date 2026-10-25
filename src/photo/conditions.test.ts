// @vitest-environment node
import { frameStats, judge, settle } from './conditions.ts'

const W = 160
const H = 120
function frame(fill: (x: number, y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4)
  let s = 7
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      s = (s * 1103515245 + 12345) % 2 ** 31
      const v = Math.min(255, Math.max(0, fill(x, y) + (s / 2 ** 31) * 6))
      const p = (y * W + x) * 4
      d[p] = d[p + 1] = d[p + 2] = v
      d[p + 3] = 255
    }
  return d
}
const venus = { name: 'Venus', x: 80, y: 50, magnitude: -4.2 }

describe('Sky Check', () => {
  it('clear: the expected planet shows up where predicted', () => {
    const f = frame(
      (x, y) =>
        (Math.hypot(x - 81, y - 50) < 1.5 ? 230 : 12) + (Math.hypot(x - 30, y - 90) < 1 ? 120 : 0),
    )
    const v = judge(frameStats(f, W, H), [venus], -20, 30)
    expect(v.condition).toBe('clear')
    expect(v.seen.Venus).toBe(true)
  })
  it('cloudy: a smooth glowing frame with no Venus where it should be', () => {
    const f = frame((x, y) => 70 + 25 * Math.sin(x / 25) * Math.cos(y / 30))
    const v = judge(frameStats(f, W, H), [venus], -20, 30)
    expect(v.condition).toBe('cloudy')
    expect(v.reason).toMatch(/Venus should be right here/)
  })
  it('blocked: busy edges low in the sky (branches)', () => {
    const f = frame((x, y) => ((Math.floor(x / 3) + Math.floor(y / 4)) % 2 ? 160 : 10))
    expect(judge(frameStats(f, W, H), [venus], -20, 12).condition).toBe('blocked')
  })
  it('bright: the Sun is up', () => {
    expect(
      judge(
        frameStats(
          frame(() => 200),
          W,
          H,
        ),
        [venus],
        10,
        30,
      ).condition,
    ).toBe('bright')
  })
  it('does not blame clouds for objects too faint for a phone camera', () => {
    const f = frame(() => 12)
    const v = judge(frameStats(f, W, H), [{ name: 'Polaris', x: 80, y: 50, magnitude: 2 }], -20, 40)
    expect(v.condition).not.toBe('cloudy')
  })
  it('settles on the most common recent verdict', () => {
    expect(settle(['clear', 'cloudy', 'cloudy', 'partly', 'cloudy'])).toBe('cloudy')
  })
})
