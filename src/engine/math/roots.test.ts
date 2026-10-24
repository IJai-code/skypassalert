// @vitest-environment node
import { brentMax, brentRoot } from './roots.ts'

describe('Brent root-finding', () => {
  it('finds π/2 as the root of cos on [0, 3]', () => {
    expect(brentRoot(Math.cos, 0, 3, 1e-12)).toBeCloseTo(Math.PI / 2, 11)
  })
  it('uses few evaluations on a smooth function', () => {
    let calls = 0
    brentRoot((x) => (calls++, x * x * x - 2), 0, 2, 1e-12)
    expect(calls).toBeLessThan(15)
  })
  it('refuses an unbracketed root', () => {
    expect(() => brentRoot((x) => x * x + 1, -1, 1, 1e-9)).toThrow(RangeError)
  })
})

describe('Brent maximisation', () => {
  it('finds the top of a parabola', () => {
    const r = brentMax((x) => 5 - (x - 1.234) ** 2, -10, 10, 1e-9)
    expect(r.t).toBeCloseTo(1.234, 6)
    expect(r.value).toBeCloseTo(5, 9)
  })
})
