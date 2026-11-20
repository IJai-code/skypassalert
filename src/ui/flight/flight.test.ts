// @vitest-environment node
import { forecast } from '../../engine/predict.ts'
import type { OmmElements } from '../../engine/index.ts'
import elements from '../../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../../presets.ts'
import { passScore } from '../../engine/sky/schedule.ts'
import { sampleAt } from '../wave/station.ts'
import { postcardView } from '../stageView.ts'
import { enu } from '../../sky/projection.ts'
import {
  EYE_KM,
  altitudeKm,
  hitEarth,
  horizonDipDeg,
  makeWorld,
  stationFromLook,
  stationFromOrbit,
  sunDirection,
} from './world.ts'
import {
  groundCamera,
  horizonFrac,
  horizonPitchDeg,
  liftCamera,
  openingCamera,
  projectDir,
  projectPoint,
  smoothedYaw,
  turnSky,
  wideCamera,
  type GroundRig,
  type Screen,
} from './camera.ts'
import { at, duskTimeline, passTimeline, progressForClock } from './timeline.ts'
import {
  coastBuffer,
  frameAt,
  labelsAt,
  makeFilm,
  skySpin,
  spinDir,
  stationAlongTrack,
} from './film.ts'
import { lightStyle, toPixel } from './textures.ts'
import { len, sub, slerp, unit, type V3 } from './vec.ts'

const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 8,
})
// The best-looking pass in the fixture week: a real track to fly through.
const pass = [...f.passes].sort((a, b) => passScore(b) - passScore(a))[0]!
const world = makeWorld(FREMONT)
const phone: Screen = { width: 390, height: 844 }
const stationAlongTrackForTest = (t: number) => stationAlongTrack(pass.track, t)
const rig: GroundRig = {
  track: pass.track,
  yaw: smoothedYaw(pass.track),
  az0: postcardView(pass).az,
}

describe('the world frame', () => {
  it('puts you at the origin with Earth’s centre straight below', () => {
    expect(world.R).toBeGreaterThan(6360)
    expect(world.R).toBeLessThan(6380)
    expect(world.centre).toEqual([0, 0, -world.R])
  })

  it('agrees with itself: the station from orbit samples = the station from az/el/range', () => {
    for (const p of pass.track) {
      const fromLook = stationFromLook(p.azDeg, p.elDeg, p.rangeKm)
      const fromOrbit = stationFromOrbit(world, sampleAt(pass.station.samples, p.unixMs))
      // 30-second samples, linearly interpolated: a kilometre or two of chord error.
      expect(len(sub(fromLook, fromOrbit))).toBeLessThan(5)
    }
  })

  it('has the station a few hundred km up', () => {
    const s = stationFromOrbit(world, pass.station.samples[0]!)
    const h = altitudeKm(world, s)
    expect(h).toBeGreaterThan(330)
    expect(h).toBeLessThan(460)
  })

  it('has the Sun below your horizon during an evening or dawn pass', () => {
    const sun = sunDirection(world, pass.station.subsolar)
    expect(Math.abs(len(sun) - 1)).toBeLessThan(1e-9)
    expect(sun[2]).toBeLessThan(0)
  })

  it('traces rays like the shader: the horizon dips 0.04° for eyes 1.7 m up', () => {
    const eye: V3 = [0, 0, EYE_KM]
    expect(horizonDipDeg(world.R, EYE_KM)).toBeCloseTo(0.042, 2)
    expect(hitEarth(world, eye, EYE_KM, enu(0, 1))).toBeNull()
    expect(hitEarth(world, eye, EYE_KM, enu(0, 0))).toBeNull()
    // Just below the dip, the ray meets the ground a few km out: for eyes
    // 1.7 m up, the horizon is only √(2Rh) ≈ 4.7 km away.
    const graze = hitEarth(world, eye, EYE_KM, enu(0, -0.05))!
    expect(graze).toBeGreaterThan(1)
    expect(graze).toBeLessThan(Math.sqrt(2 * world.R * EYE_KM))
    // Straight down: 1.7 m.
    expect(hitEarth(world, eye, EYE_KM, [0, 0, -1])!).toBeCloseTo(EYE_KM, 6)
  })
})

describe('the camera', () => {
  it('opens with the horizon just above where the answer is set', () => {
    const cam = groundCamera(rig, pass.start.unixMs, phone, 0)
    const h = projectDir(cam, phone, enu(rig.az0, 0))!
    expect(horizonFrac(phone)).toBe(0.56) // a tall phone (CSS: max-aspect-ratio 1/2)
    expect(horizonFrac({ width: 375, height: 667 })).toBe(0.5)
    expect(horizonFrac({ width: 1440, height: 900 })).toBe(0.6)
    expect(h.y / phone.height).toBeCloseTo(horizonFrac(phone), 2)
    expect(h.x / phone.width).toBeCloseTo(0.5, 2)
    expect(horizonPitchDeg(60, 0.5)).toBeCloseTo(0, 9)
  })

  it('keeps the station in frame through the whole pass', () => {
    for (const p of pass.track) {
      const cam = groundCamera(rig, p.unixMs, phone, 1)
      const s = projectDir(cam, phone, enu(p.azDeg, p.elDeg))!
      expect(s).not.toBeNull()
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(phone.width)
      expect(s.y).toBeGreaterThan(0)
      expect(s.y).toBeLessThan(phone.height)
    }
  })

  it('reduced motion: one wide frame holds the whole pass', () => {
    const cam = wideCamera(rig, phone)
    const inFrame = pass.track.filter((p) => {
      const s = projectDir(cam, phone, enu(p.azDeg, p.elDeg))
      return s && s.x > 0 && s.x < phone.width && s.y > 0 && s.y < phone.height
    })
    // A phone is narrow; most of the path (not always all of it) fits.
    expect(inFrame.length / pass.track.length).toBeGreaterThan(0.5)
  })

  it('dives from the opening shot to the yard without a jump, eyes on the horizon midway', () => {
    const ground = groundCamera(rig, pass.start.unixMs, phone, 0)
    const opening = openingCamera(world, rig.az0, phone)
    const station = stationAlongTrackForTest(pass.start.unixMs)
    let prev = liftCamera(world, ground, opening, 0, station)
    expect(prev).toBe(ground)
    for (let i = 1; i <= 400; i++) {
      const c = liftCamera(world, ground, opening, i / 400, station)
      // Each step turns the view by under 1.5° and moves the eye by under 5%
      // of its height (or 200 m near the ground).
      const turn = Math.acos(
        Math.min(
          1,
          c.forward[0] * prev.forward[0] +
            c.forward[1] * prev.forward[1] +
            c.forward[2] * prev.forward[2],
        ),
      )
      expect(turn * 57.3).toBeLessThan(1.5)
      expect(len(sub(c.eye, prev.eye))).toBeLessThan(Math.max(0.2, prev.eyeAlt * 0.05) + 40)
      expect(Math.abs(altitudeKm(world, c.eye) - c.eyeAlt)).toBeLessThan(
        1e-3 * Math.max(1, c.eyeAlt),
      )
      prev = c
    }
    expect(prev).toBe(opening)
    // A third of the way down from orbit, the camera looks out at the horizon
    // (not up into black sky, not straight down).
    const mid = liftCamera(world, ground, opening, 0.25, station)
    const local = unit(sub(mid.eye, world.centre))
    const tilt =
      (Math.asin(
        mid.forward[0] * local[0] + mid.forward[1] * local[1] + mid.forward[2] * local[2],
      ) *
        180) /
      Math.PI
    expect(Math.abs(tilt)).toBeLessThan(25)
  })

  it('opening shot: Earth’s glowing edge across the middle, you below it, space above', () => {
    for (const screen of [phone, { width: 1280, height: 800 }]) {
      const cam = openingCamera(world, 250, screen)
      // Straight up the middle of the screen: space at the top, Earth at the bottom.
      const at = (fy: number) => {
        const t = Math.atan((1 - 2 * fy) * Math.tan((cam.vfovDeg / 2) * (Math.PI / 180)))
        return slerp(cam.forward, cam.up, (t * 180) / Math.PI / 90)
      }
      expect(hitEarth(world, cam.eye, cam.eyeAlt, at(0.3))).toBeNull()
      expect(hitEarth(world, cam.eye, cam.eyeAlt, at(0.55))).not.toBeNull()
      const you = projectPoint(cam, screen, [0, 0, 0])!
      expect(you.y / screen.height).toBeGreaterThan(0.5)
      expect(you.y / screen.height).toBeLessThan(0.9)
      expect(you.x / screen.width).toBeCloseTo(0.5, 1)
    }
  })
})

describe('scroll is the clock', () => {
  const tl = passTimeline(pass.start.unixMs, pass.end.unixMs, pass.start.unixMs - 3_600_000)

  it('starts at the pass start, ends at the pass end, and never runs backwards', () => {
    expect(at(tl, 0).clockMs).toBe(pass.start.unixMs)
    expect(at(tl, 1).clockMs).toBe(pass.end.unixMs)
    let last = -Infinity
    for (let i = 0; i <= 200; i++) {
      const a = at(tl, i / 200)
      expect(a.clockMs).toBeGreaterThanOrEqual(last)
      last = a.clockMs
    }
  })

  it('walks through the beats in order: orbit, dive, pass, settle', () => {
    expect(at(tl, 0).beat).toBe('orbit')
    expect(at(tl, 0.25).beat).toBe('dive')
    expect(at(tl, 0.6).beat).toBe('pass')
    expect(at(tl, 0.95).beat).toBe('settle')
    expect(at(tl, -1).beat).toBe('orbit')
    expect(at(tl, 2).beat).toBe('settle')
  })

  it('opens in orbit, dives to the yard, and stays there for the pass', () => {
    expect(at(tl, 0).lift).toBe(1)
    expect(at(tl, 0.1).lift).toBe(1)
    expect(at(tl, 0.26).lift).toBeGreaterThan(0.2)
    expect(at(tl, 0.26).lift).toBeLessThan(0.8)
    expect(at(tl, 0.45).lift).toBe(0)
    expect(at(tl, 1).lift).toBe(0)
  })

  it('keeps the big answer up until the dive starts', () => {
    expect(at(tl, 0).dock).toBe(0)
    expect(at(tl, 0.05).dock).toBe(0)
    expect(at(tl, 0.2).dock).toBe(1)
  })

  it('opens at "now" if the station is already up', () => {
    const mid = (pass.start.unixMs + pass.end.unixMs) / 2
    expect(passTimeline(pass.start.unixMs, pass.end.unixMs, mid).clock0).toBe(mid)
  })

  it('maps a time back to the scroll that shows it', () => {
    const t = pass.start.unixMs + 90_000
    expect(at(tl, progressForClock(tl, t)).clockMs).toBeCloseTo(t, 0)
  })

  it('reduced motion: cuts instead of flying, and the camera holds still', () => {
    expect(at(tl, 0.2, true).lift).toBe(1)
    expect(at(tl, 0.3, true).lift).toBe(0)
    expect(at(tl, 0.6, true).follow).toBe(false)
    expect(at(tl, 0.1, true).dock).toBe(0)
    expect(at(tl, 0.13, true).dock).toBe(1)
  })

  it('a night with no pass: orbit, dive, then dusk into dark', () => {
    const d = duskTimeline(1_000_000, 4_600_000)
    expect(d.spans.map((s) => s.beat)).toEqual(['orbit', 'dive', 'dusk', 'settle'])
    expect(at(d, 0.6).beat).toBe('dusk')
    expect(at(d, 0.6).lift).toBe(0)
    expect(at(d, 1).clockMs).toBe(4_600_000)
  })
})

describe('film frames', () => {
  const film = makeFilm({ kind: 'pass', place: FREMONT, pass, nowMs: 0, catalog: null })

  it('turns the sky westward, once per sidereal day', () => {
    // A star due south on the celestial equator, an hour later, has moved west.
    const southEquator = enu(180, 90 - FREMONT.latDeg)
    const later = spinDir(skySpin(film, 0, 3_600_000), southEquator)
    const az = (Math.atan2(later[0], later[1]) * 180) / Math.PI
    expect((az + 360) % 360).toBeGreaterThan(190)
    expect((az + 360) % 360).toBeLessThan(230)
    // The 2D picture's helper turns the sky the same way.
    const viaHelper = turnSky(southEquator, FREMONT.latDeg, 3_600_000)
    expect(len(sub(viaHelper, later))).toBeLessThan(1e-6) // the GPU matrix is float32
    // A whole sidereal day brings it back.
    const day = spinDir(skySpin(film, 0, 86_164_090.5), southEquator)
    expect(len(sub(day, southEquator))).toBeLessThan(1e-6)
  })

  it('shows the station in your sky during the pass, sunlit', () => {
    const f = frameAt(film, 0.55, phone, false)
    expect(f.at.beat).toBe('pass')
    expect(f.space).toBe(0)
    expect(f.station!.sunlit).toBeGreaterThan(0.5)
    const p = projectPoint(f.cam, phone, f.station!.pos)!
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(phone.width)
  })

  it('opens from orbit: above the air, with you, the station and the line between you', () => {
    const f = frameAt(film, 0, phone, false)
    expect(f.space).toBe(1)
    expect(f.lineOfSight).not.toBeNull()
    const labels = labelsAt(film, f, phone, {
      formatMinute: () => '7:33',
      stationShort: 'ISS',
      placeShort: 'Fremont',
    })
    expect(labels.map((l) => l.text)).toContain('You · Fremont')
    // No compass letters or minute times up there.
    expect(labels.some((l) => l.kind === 'compass' || l.kind === 'minute')).toBe(false)
  })

  it('labels the ground view: compass points and the minutes along the path', () => {
    const f = frameAt(film, 0.55, phone, false)
    const labels = labelsAt(film, f, phone, { formatMinute: () => 'm', stationShort: 'ISS' })
    expect(labels.some((l) => l.kind === 'compass')).toBe(true)
    expect(labels.some((l) => l.kind === 'minute')).toBe(true)
  })

  it('draws coastlines on the sphere, in pairs, skipping the date line', () => {
    const earth = { land: [[-1800, 0, -1790, 10, 1790, 20]], seas: [] }
    const c = coastBuffer(film.world, earth)
    expect(c.length).toBe(6) // one segment kept, the one across 180° dropped
    const a: V3 = [c[0]!, c[1]!, c[2]!]
    expect(Math.abs(len(sub(a, film.world.centre)) - film.world.R)).toBeLessThan(1e-5) // 1 cm
  })

  it('a pass-free night faces the thing to see and tilts up to it once you scroll', () => {
    const dusk = makeFilm({
      kind: 'dusk',
      place: FREMONT,
      fromMs: pass.start.unixMs,
      toMs: pass.start.unixMs + 3 * 3_600_000,
      faceAz: 180,
      highlight: { dir: enu(180, 55), refMs: pass.start.unixMs, label: 'Saturn' },
      live: f.live,
      catalog: null,
    })
    expect(dusk.trail).toBeNull()
    expect(dusk.orbits.starts).toHaveLength(2) // both stations' live orbits
    const start = frameAt(dusk, 0.37, phone, false)
    const later = frameAt(dusk, 0.6, phone, false)
    expect(later.cam.forward[2]).toBeGreaterThan(start.cam.forward[2])
    const ring = labelsAt(dusk, later, phone, { formatMinute: () => '', stationShort: '' })
    expect(ring.some((l) => l.text === 'Saturn')).toBe(true)
  })
})

describe('globe textures', () => {
  it('maps longitude and latitude onto the equirectangular texture', () => {
    expect(toPixel(-180, 90)).toEqual({ x: 0, y: 0 })
    expect(toPixel(0, 0)).toEqual({ x: 1024, y: 512 })
    expect(toPixel(180, -90)).toEqual({ x: 2048, y: 1024 })
  })

  it('makes bigger cities brighter and wider, within bounds', () => {
    let prev = { radius: 0, alpha: 0 }
    for (let level = 1; level <= 9; level++) {
      const s = lightStyle(level)
      expect(s.radius).toBeGreaterThan(prev.radius)
      expect(s.alpha).toBeGreaterThanOrEqual(prev.alpha)
      expect(s.alpha).toBeLessThanOrEqual(1)
      prev = s
    }
  })
})
