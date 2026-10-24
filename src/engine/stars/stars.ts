// Bright stars for the sky renderer and for human cues ("passes right by
// Vega"). Positions are J2000 from the Yale Bright Star Catalogue, precessed
// to the date; proper motion (< 10″/yr for all but a few) is ignored.
// Learn: docs/learn/10-sky-objects.md#stars
import { DEG } from '../math/constants.ts'
import type { Vec3 } from '../math/vec.ts'
import { precessFromJ2000 } from '../frames/precession.ts'

export type StarCatalog = {
  source: string
  /** [RA°, Dec°, V magnitude, B−V colour] at J2000. */
  stars: ReadonlyArray<readonly [number, number, number, number]>
  /** Common name → index into `stars`. */
  named: Readonly<Record<string, number>>
  /** Pattern name → index pairs to draw as lines. */
  lines: Readonly<Record<string, ReadonlyArray<readonly [number, number]>>>
}

/** Unit vectors (mean equator/equinox of date) for every star. */
export function starVectorsOfDate(catalog: StarCatalog, jdTt: number): Vec3[] {
  const t = (jdTt - 2_451_545.0) / 36_525
  return catalog.stars.map(([ra, dec]) => {
    const r = ra * DEG
    const d = dec * DEG
    return precessFromJ2000([Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)], t)
  })
}

/** Approximate star colour from B−V (Ballesteros 2012 temperature → sRGB-ish). */
export function starColor(bv: number): string {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
  if (t > 9000) return '#cad7ff'
  if (t > 7000) return '#e4e9ff'
  if (t > 5800) return '#fff6ea'
  if (t > 4800) return '#ffe5c4'
  return '#ffcf9e'
}
