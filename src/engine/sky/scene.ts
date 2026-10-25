// Everything visible in one observer's sky at one instant, as azimuth /
// elevation: what the sky renderer draws (hero picture and Sky View).
// Learn: docs/learn/10-sky-objects.md
import { DEG, RAD } from '../math/constants.ts'
import { type Vec3, angleBetween, scale, sub, wrap360 } from '../math/vec.ts'
import { lookAtTeme, makeObserver } from '../frames/observer.ts'
import type { Place } from '../place.ts'
import { moonPositionKm } from '../moon/moon.ts'
import { PLANETS, planetState, type PlanetId } from '../planets/planets.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { skyAt } from './sky.ts'
import { starVectorsOfDate, type StarCatalog } from '../stars/stars.ts'

export type AzEl = { azDeg: number; elDeg: number }

export type SkyScene = {
  unixMs: number
  sun: AzEl
  moon: AzEl & { illumination: number; waxing: boolean; brightLimbAngleDeg: number }
  planets: Array<AzEl & { id: PlanetId; magnitude: number }>
  /** Parallel arrays, index-aligned with the catalog. */
  stars: { az: Float32Array; el: Float32Array }
}

/** Direction (unit vector, mean-of-date equatorial) → local az/el. */
export function directionToAzEl(dir: Vec3, gmstRad: number, latDeg: number, lonDeg: number): AzEl {
  const lst = gmstRad + lonDeg * DEG
  const ra = Math.atan2(dir[1], dir[0])
  const dec = Math.asin(Math.max(-1, Math.min(1, dir[2])))
  const ha = lst - ra
  const lat = latDeg * DEG
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(ha),
    Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha),
  )
  return { azDeg: wrap360(az * RAD), elDeg: el * RAD }
}

export function skyScene(
  place: Place,
  unixMs: number,
  catalog: StarCatalog | null,
  eop: EopTable = DEFAULT_EOP,
): SkyScene {
  const sky = skyAt(unixMs, eop)
  const observer = makeObserver(place)
  const sunLook = lookAtTeme(observer, sky.sunTeme, sky.gmstRad)
  const moonVec = moonPositionKm(sky.jdTt)
  const moonLook = lookAtTeme(observer, moonVec, sky.gmstRad)
  const phase = angleBetween(sub(sky.sunTeme, moonVec), scale(moonVec, -1))
  const sunLon = Math.atan2(sky.sunTeme[1], sky.sunTeme[0])
  const moonLon = Math.atan2(moonVec[1], moonVec[0])

  // Angle on the sky from the Moon towards the Sun: which side is lit.
  const brightLimbAngleDeg =
    Math.atan2(
      Math.cos(sunLook.elDeg * DEG) * Math.sin((sunLook.azDeg - moonLook.azDeg) * DEG),
      Math.sin(sunLook.elDeg * DEG) * Math.cos(moonLook.elDeg * DEG) -
        Math.cos(sunLook.elDeg * DEG) *
          Math.sin(moonLook.elDeg * DEG) *
          Math.cos((sunLook.azDeg - moonLook.azDeg) * DEG),
    ) * RAD

  const planets = PLANETS.map((id) => {
    const st = planetState(id, sky.jdTt)
    const l = lookAtTeme(observer, st.positionKm, sky.gmstRad)
    return { id, azDeg: l.azDeg, elDeg: l.elDeg, magnitude: st.magnitude }
  })

  const n = catalog?.stars.length ?? 0
  const az = new Float32Array(n)
  const el = new Float32Array(n)
  if (catalog) {
    const vecs = starVectorsOfDate(catalog, sky.jdTt)
    for (let i = 0; i < n; i++) {
      const a = directionToAzEl(vecs[i]!, sky.gmstRad, place.latDeg, place.lonDeg)
      az[i] = a.azDeg
      el[i] = a.elDeg
    }
  }

  return {
    unixMs,
    sun: { azDeg: sunLook.azDeg, elDeg: sunLook.elDeg },
    moon: {
      azDeg: moonLook.azDeg,
      elDeg: moonLook.elDeg,
      illumination: (1 + Math.cos(phase)) / 2,
      waxing: ((((moonLon - sunLon) * RAD) % 360) + 360) % 360 < 180,
      brightLimbAngleDeg,
    },
    planets,
    stars: { az, el },
  }
}

/** Great-circle angle between two sky directions, degrees. */
export function separationDeg(a: AzEl, b: AzEl): number {
  const s =
    Math.sin(a.elDeg * DEG) * Math.sin(b.elDeg * DEG) +
    Math.cos(a.elDeg * DEG) * Math.cos(b.elDeg * DEG) * Math.cos((a.azDeg - b.azDeg) * DEG)
  return Math.acos(Math.max(-1, Math.min(1, s))) * RAD
}

export type Landmark = {
  kind: 'star' | 'planet' | 'moon'
  name: string
  separationDeg: number
  atMs: number
}

/**
 * The most recognisable object the pass goes close to: a bright named star,
 * a planet or the Moon within `maxDeg` of the track. "It passes right by Vega"
 * is the kind of cue that makes a stranger's sky feel familiar.
 */
export function nearestLandmark(
  track: ReadonlyArray<AzEl & { unixMs: number }>,
  scene: SkyScene,
  catalog: StarCatalog | null,
  maxDeg = 8,
): Landmark | null {
  const candidates: Array<{ kind: Landmark['kind']; name: string; pos: AzEl; weight: number }> = []
  if (scene.moon.elDeg > 0 && scene.moon.illumination > 0.05) {
    candidates.push({ kind: 'moon', name: 'the Moon', pos: scene.moon, weight: 0 })
  }
  for (const p of scene.planets) {
    if (p.elDeg > 0 && p.magnitude < 1.5) {
      candidates.push({
        kind: 'planet',
        name: p.id[0]!.toUpperCase() + p.id.slice(1),
        pos: p,
        weight: p.magnitude,
      })
    }
  }
  if (catalog) {
    for (const [name, i] of Object.entries(catalog.named)) {
      const mag = catalog.stars[i]![2]
      if (mag > 1.6 || scene.stars.el[i]! <= 5) continue
      candidates.push({
        kind: 'star',
        name,
        pos: { azDeg: scene.stars.az[i]!, elDeg: scene.stars.el[i]! },
        weight: mag,
      })
    }
  }
  let best: Landmark | null = null
  let bestScore = Infinity
  for (const c of candidates) {
    for (const p of track) {
      const sep = separationDeg(c.pos, p)
      if (sep > maxDeg) continue
      // Prefer brighter objects and closer approaches.
      const score = sep + 2 * c.weight
      if (score < bestScore) {
        bestScore = score
        best = { kind: c.kind, name: c.name, separationDeg: sep, atMs: p.unixMs }
      }
    }
  }
  return best
}
