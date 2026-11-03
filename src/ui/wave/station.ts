// The numbers behind Wave Back's sentence: where the station is between
// samples, how far it is from you, and why you can (or can't) see it.
// Learn: docs/learn/14-wave-back.md
import type { OrbitSample } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { geodeticToEcef } from '../../engine/frames/frames.ts'

/** The station's place above Earth at time t, between 30-second samples. */
export function sampleAt(samples: readonly OrbitSample[], t: number): OrbitSample {
  const first = samples[0]!
  if (t <= first.unixMs) return first
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!
    const b = samples[i]!
    if (t > b.unixMs) continue
    const f = (t - a.unixMs) / Math.max(1, b.unixMs - a.unixMs)
    let dl = b.lonDeg - a.lonDeg
    if (dl > 180) dl -= 360
    if (dl < -180) dl += 360
    return {
      unixMs: t,
      latDeg: a.latDeg + (b.latDeg - a.latDeg) * f,
      lonDeg: ((a.lonDeg + dl * f + 540) % 360) - 180,
      heightKm: a.heightKm + (b.heightKm - a.heightKm) * f,
      sunlit: a.sunlit + (b.sunlit - a.sunlit) * f,
    }
  }
  return samples[samples.length - 1]!
}

/** Straight-line distance from the observer to the station, km. */
export function distanceKm(place: Place, s: OrbitSample): number {
  const a = geodeticToEcef(place.latDeg, place.lonDeg, place.elevationM / 1000)
  const b = geodeticToEcef(s.latDeg, s.lonDeg, s.heightKm)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** The sentence under the globe, from the numbers on it. */
export function waveSentence(o: {
  station: string
  time: string
  heightKm: number
  ground: string
  placeName: string
  distanceKm: number
  sunlit: number
  yourSunDeg: number
}): string {
  const lead = `At ${o.time}, ${o.station} is ${Math.round(o.heightKm)} km up, ${o.ground}.`
  const far = `It is ${Math.round(o.distanceKm / 10) * 10} km from you in ${o.placeName}.`
  let why: string
  if (o.sunlit < 0.5)
    why =
      'It has slipped into Earth’s shadow: no sunlight reaches it, so it vanishes from your sky.'
  else if (o.yourSunDeg > -4)
    why = 'It is in sunlight, but your sky is still too bright to pick it out.'
  else
    why =
      'You are in the dark, but up there the Sun is still shining on it. That reflected sunlight is what you see.'
  return `${lead} ${far} ${why}`
}
