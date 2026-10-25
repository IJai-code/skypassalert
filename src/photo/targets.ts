// What's worth pointing at right now, and how to photograph each kind of
// thing with a phone, honestly.
// Learn: docs/learn/12-sky-camera.md#targets
import type { SkyScene } from '../engine/sky/scene.ts'
import type { StarCatalog } from '../engine/stars/stars.ts'
import type { ForecastPass } from '../engine/index.ts'
import { stationName } from '../copy/en.ts'
import type { ShotKind } from './stack.ts'

export type Target = {
  id: string
  name: string
  kind: ShotKind
  azDeg: number
  elDeg: number
  magnitude: number
  /** For a station: the pass it belongs to. */
  pass?: ForecastPass
  /** Short line under the name. */
  detail: string
}

export const RECIPES: Record<
  ShotKind,
  { title: string; tip: string; expect: string; native: string }
> = {
  moon: {
    title: 'Moon',
    tip: 'Zoom in and hold steady. We take a burst, keep the sharpest frames, line them up and stack them.',
    expect: 'Craters and seas show clearly. Stacking removes grain and shake.',
    native:
      'For the sharpest Moon on iPhone: in the Camera app, switch to your longest lens (3× or 5×), press and hold on the Moon until “AE/AF Lock” appears, then drag the sun slider down until craters appear. Use the 3-second timer.',
  },
  planet: {
    title: 'Planet',
    tip: 'Rest the phone on something solid. We stack the sharpest frames.',
    expect:
      'On a phone alone a planet is a bright point (Jupiter’s moons sometimes show as tiny dots). For Saturn’s rings or Jupiter’s bands, hold the phone to a telescope or binocular eyepiece: this mode is built for that.',
    native:
      'Through a telescope eyepiece: lock focus and exposure on the planet, lower exposure, record a few seconds of video.',
  },
  stars: {
    title: 'Stars',
    tip: 'Rest the phone against something. We stack frames to pull faint stars out of the noise.',
    expect:
      'Bright stars and patterns come out cleanly; the faintest need the iPhone’s Night mode on a tripod.',
    native:
      'For a deep star field on iPhone: tripod, Camera app, Night mode set to the longest time (up to 30 s on a tripod).',
  },
  trail: {
    title: 'Station trail',
    tip: 'Hold still and start a few seconds before it enters the frame. We layer the frames into a light trail.',
    expect: 'A bright streak across the frame, like a long exposure.',
    native:
      'For a long trail on iPhone: tripod, Live Photo on, then in Photos choose “Long Exposure”.',
  },
}

const PLANET_NAMES: Record<string, string> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
}

/** Visible targets, best first: stations in progress, Moon, planets, the brightest stars. */
export function targetsFor(
  scene: SkyScene,
  catalog: StarCatalog | null,
  passes: readonly ForecastPass[],
  nowMs: number,
): Target[] {
  const out: Target[] = []
  for (const p of passes) {
    if (p.end.unixMs < nowMs || p.start.unixMs - nowMs > 3 * 3_600_000) continue
    const live = p.start.unixMs <= nowMs
    out.push({
      id: `pass-${p.noradId}-${p.start.unixMs}`,
      name: stationName(p.noradId).short,
      kind: 'trail',
      azDeg: p.start.azDeg,
      elDeg: p.start.elDeg,
      magnitude: p.brightestMagnitude,
      pass: p,
      detail: live
        ? 'Up now'
        : `Rises ${new Date(p.start.unixMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    })
  }
  if (scene.moon.elDeg > 0 && scene.moon.illumination > 0.03) {
    out.push({
      id: 'moon',
      name: 'Moon',
      kind: 'moon',
      azDeg: scene.moon.azDeg,
      elDeg: scene.moon.elDeg,
      magnitude: -10,
      detail: `${Math.round(scene.moon.illumination * 100)}% lit`,
    })
  }
  for (const pl of scene.planets) {
    if (pl.elDeg > 3 && pl.magnitude < 2) {
      out.push({
        id: pl.id,
        name: PLANET_NAMES[pl.id] ?? pl.id,
        kind: 'planet',
        azDeg: pl.azDeg,
        elDeg: pl.elDeg,
        magnitude: pl.magnitude,
        detail: `${Math.round(pl.elDeg)}° up`,
      })
    }
  }
  if (catalog) {
    const stars = Object.entries(catalog.named)
      .map(([name, i]) => ({ name, i, mag: catalog.stars[i]![2] }))
      .filter((s) => s.mag < 1 && scene.stars.el[s.i]! > 10)
      .sort((a, b) => a.mag - b.mag)
      .slice(0, 4)
    for (const s of stars) {
      out.push({
        id: `star-${s.name}`,
        name: s.name,
        kind: 'stars',
        azDeg: scene.stars.az[s.i]!,
        elDeg: scene.stars.el[s.i]!,
        magnitude: s.mag,
        detail: 'Bright star',
      })
    }
  }
  return out
}
