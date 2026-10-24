// @vitest-environment node
import { sunlitCylindrical, sunlitFractionConical } from './shadow.ts'
import { AU_KM } from '../math/constants.ts'

const sun = [AU_KM, 0, 0] as const
const r = 6378.137 + 420 // ISS-like orbit radius

describe('Earth shadow models', () => {
  it('sunward side is fully lit in both models', () => {
    expect(sunlitCylindrical([r, 0, 0], sun)).toBe(1)
    expect(sunlitFractionConical([r, 0, 0], sun)).toBe(1)
  })
  it('directly behind Earth is fully dark in both models', () => {
    expect(sunlitCylindrical([-r, 0, 0], sun)).toBe(0)
    expect(sunlitFractionConical([-r, 0, 0], sun)).toBe(0)
  })
  it('the conical model has a penumbra: partial light near the shadow edge', () => {
    // Walk across the shadow edge on the night side and find intermediate values.
    const fractions = Array.from({ length: 200 }, (_, i) => {
      const angle = Math.PI / 2 + (i / 199) * 0.6 // from the terminator into the night side
      return sunlitFractionConical([r * Math.cos(angle), r * Math.sin(angle), 0], sun)
    })
    expect(fractions.some((f) => f > 0.05 && f < 0.95)).toBe(true)
    // Monotone: once it starts dimming it never brightens again on this path.
    for (let i = 1; i < fractions.length; i++)
      expect(fractions[i]!).toBeLessThanOrEqual(fractions[i - 1]! + 1e-12)
  })
})
