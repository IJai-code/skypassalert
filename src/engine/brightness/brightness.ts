// How bright will it look? A diffuse-sphere model.
// Learn: docs/learn/06-brightness.md
//
//   m = m₀ + 5·log₁₀(d / 1000 km) − 2.5·log₁₀(F(φ)) − 2.5·log₁₀(f)
//
// m₀ "standard magnitude": the satellite's brightness at 1000 km, half lit
//    (phase angle φ = 90°). Fitted per object, see STANDARD_MAGNITUDE.
// F(φ) = sin φ + (π − φ)·cos φ, the diffuse (Lambertian) sphere phase law,
//    normalised so F(90°) = 1. Full phase (φ = 0) gives F = π, i.e. 1.24 mag
//    brighter than half phase.
// f    sunlit fraction from the conical shadow model (dimming in penumbra).
//
// Like most published predictions we leave out atmospheric extinction, so our
// numbers compare directly with other tools. Near the horizon the real object
// looks ~1 mag fainter (k ≈ 0.2 mag × airmass ≈ 5.6 at 10°); the UI's
// brightness words account for that by only promising "bright" for high passes.
// Real stations are flat panels, not spheres; glints and panel angles make
// single passes differ from this model by about ±0.5 mag (documented error).

/**
 * Standard magnitudes (1000 km range, 90° phase), fitted to Heavens-Above's
 * published peak magnitudes for Fremont, 2026-10-24 → 11-02
 * (src/engine/__fixtures__/heavens-above-fremont-2026-10-24.json).
 * Fit residuals: ISS σ ≈ 0.15 mag (6 passes); Tiangong σ ≈ 0.2 mag on 7 of 9
 * passes, with two shadow-ending passes 1.1–1.3 mag off (see the chapter).
 */
export const STANDARD_MAGNITUDE: Readonly<Record<number, number>> = {
  25544: -1.5, // ISS
  48274: 0.4, // Tiangong (CSS): ~1/4 of the ISS's sunlit area, so ~1.5–2 mag fainter
}
export const DEFAULT_STANDARD_MAGNITUDE = 2.0

export function phaseFunction(phaseRad: number): number {
  return Math.sin(phaseRad) + (Math.PI - phaseRad) * Math.cos(phaseRad)
}

export function satelliteMagnitude(args: {
  standardMagnitude: number
  rangeKm: number
  phaseRad: number
  sunlitFraction: number
}): number {
  const { standardMagnitude, rangeKm, phaseRad, sunlitFraction } = args
  if (sunlitFraction <= 0) return Number.POSITIVE_INFINITY
  const F = Math.max(phaseFunction(phaseRad), 1e-6)
  return (
    standardMagnitude +
    5 * Math.log10(rangeKm / 1000) -
    2.5 * Math.log10(F) -
    2.5 * Math.log10(sunlitFraction)
  )
}
