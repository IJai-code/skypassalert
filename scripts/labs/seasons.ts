// Lab: how many evenings have a good station pass? ISS vs Tiangong vs either.
// Evidence for why SkyPassAlert shows both stations and frames "tonight" as the evening.
// Learn: docs/learn/05-passes.md#seasons
//
// Caveat printed below: propagating today's elements weeks ahead gets the *times*
// wrong by minutes (drag, reboosts), but whether evening passes exist depends on
// the orbit plane's slow turning relative to the Sun, which SGP4 models well.
import { satelliteJsPropagator } from '../../src/engine/propagate/satellitejs-adapter.ts'
import { findPasses } from '../../src/engine/passes/finder.ts'
import { passPeriod, passScore } from '../../src/engine/sky/schedule.ts'
import { localDateKey } from '../../src/engine/time/zone.ts'
import { FREMONT, currentElements, predict } from './_lab.ts'

await predict(
  'Over the next 8 weeks in Fremont, on what fraction of evenings is there a pass worth going out for ' +
    '(a) for the ISS alone, (b) for Tiangong alone, (c) for either?',
)

const WEEKS = 8
const now = Date.now()
const end = now + WEEKS * 7 * 86_400_000
const goodEvenings = new Map<string, Set<string>>() // object → set of date keys
for (const el of currentElements()) {
  const sat = satelliteJsPropagator.init(el)
  const days = new Set<string>()
  for (const p of findPasses(sat, FREMONT, now, end)) {
    if (passPeriod(p, FREMONT.timeZone) === 'evening' && passScore(p) >= 0.25) {
      days.add(localDateKey(p.start.unixMs, FREMONT.timeZone))
    }
  }
  goodEvenings.set(el.OBJECT_NAME, days)
}

const names = [...goodEvenings.keys()]
console.log(`Week starting      ${names.map((n) => n.padEnd(14)).join('')}either`)
let totals = names.map(() => 0)
let eitherTotal = 0
for (let w = 0; w < WEEKS; w++) {
  const counts = names.map(() => 0)
  let either = 0
  for (let d = 0; d < 7; d++) {
    const key = localDateKey(now + (w * 7 + d) * 86_400_000, FREMONT.timeZone)
    let any = false
    names.forEach((n, i) => {
      if (goodEvenings.get(n)?.has(key)) {
        counts[i] = (counts[i] ?? 0) + 1
        any = true
      }
    })
    if (any) either++
  }
  totals = totals.map((t, i) => t + (counts[i] ?? 0))
  eitherTotal += either
  const label = localDateKey(now + w * 7 * 86_400_000, FREMONT.timeZone)
  console.log(`${label}         ${counts.map((c) => `${c}/7`.padEnd(14)).join('')}${either}/7`)
}
const n = WEEKS * 7
console.log(
  `\nShare of evenings: ${names.map((nm, i) => `${nm} ${Math.round(((totals[i] ?? 0) / n) * 100)}%`).join(', ')}, either ${Math.round((eitherTotal / n) * 100)}%`,
)
console.log(
  '\nCaveat: times this far ahead are approximate; the pattern of good and empty weeks is what this shows.',
)
