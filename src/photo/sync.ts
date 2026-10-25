// Sky Sync: compare where bright things *are* in the camera image with where
// the sky model says they should be, and correct the compass. The magnetometer
// is the weak link (cars, railings, magnets in phone cases); the Moon and
// bright planets are perfect reference points.
// Learn: docs/learn/12-sky-camera.md#sync
import type { SkyScene } from '../engine/sky/scene.ts'
import { separationDeg } from '../engine/sky/scene.ts'
import type { StarCatalog } from '../engine/stars/stars.ts'
import { azEl, unproject, type CameraBasis, type Viewport } from '../sky/projection.ts'
import { findBlobs, luminance } from './detect.ts'

export type SyncMatch = { name: string; yawErrorDeg: number; separationDeg: number }

type Ref = { name: string; azDeg: number; elDeg: number; big: boolean; weight: number }

function references(scene: SkyScene, catalog: StarCatalog | null): Ref[] {
  const refs: Ref[] = []
  if (scene.moon.elDeg > 3 && scene.moon.illumination > 0.1) {
    refs.push({
      name: 'the Moon',
      azDeg: scene.moon.azDeg,
      elDeg: scene.moon.elDeg,
      big: true,
      weight: 0,
    })
  }
  for (const p of scene.planets) {
    if (p.elDeg > 5 && p.magnitude < 1)
      refs.push({
        name: p.id[0]!.toUpperCase() + p.id.slice(1),
        azDeg: p.azDeg,
        elDeg: p.elDeg,
        big: false,
        weight: p.magnitude,
      })
  }
  if (catalog) {
    for (const [name, i] of Object.entries(catalog.named)) {
      const mag = catalog.stars[i]![2]
      if (mag < 0.6 && scene.stars.el[i]! > 8)
        refs.push({
          name,
          azDeg: scene.stars.az[i]!,
          elDeg: scene.stars.el[i]!,
          big: false,
          weight: mag + 1,
        })
    }
  }
  return refs
}

/**
 * Detect bright sources in a downscaled RGBA frame (already mapped to screen
 * coordinates by the caller via `toScreen`), match them to the sky model and
 * return the compass correction to apply, or null when nothing reliable matches.
 */
export function measureSync(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  toScreen: (x: number, y: number) => { x: number; y: number },
  cam: CameraBasis,
  vp: Viewport,
  scene: SkyScene,
  catalog: StarCatalog | null,
): SyncMatch | null {
  const blobs = findBlobs(luminance(rgba, w, h), w, h, 6)
  if (!blobs.length) return null
  const refs = references(scene, catalog)
  let best: (SyncMatch & { score: number }) | null = null
  for (const b of blobs) {
    const s = toScreen(b.x, b.y)
    const seen = azEl(unproject(s.x, s.y, cam, vp))
    if (seen.elDeg < 6) continue // street lights and windows live near the horizon
    const isBig = b.area > (w * h) / 900
    for (const r of refs) {
      if (r.big !== isBig) continue
      const sep = separationDeg(seen, r)
      if (sep > 14) continue
      let yaw = r.azDeg - seen.azDeg
      if (yaw > 180) yaw -= 360
      if (yaw < -180) yaw += 360
      const score = sep + 3 * r.weight
      if (!best || score < best.score)
        best = { name: r.name, yawErrorDeg: yaw, separationDeg: sep, score }
    }
  }
  return best
    ? { name: best.name, yawErrorDeg: best.yawErrorDeg, separationDeg: best.separationDeg }
    : null
}
