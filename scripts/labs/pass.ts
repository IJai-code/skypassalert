// Lab: find tonight's pass by hand-stepping, then compare with root-finding.
// Learn: docs/learn/05-passes.md
import { satelliteJsPropagator } from '../../src/engine/propagate/satellitejs-adapter.ts'
import { findPasses } from '../../src/engine/passes/finder.ts'
import { lookAtTeme, makeObserver } from '../../src/engine/frames/observer.ts'
import { skyAt } from '../../src/engine/sky/sky.ts'
import { FREMONT, currentElements, fmt, predict } from './_lab.ts'

await predict(
  'If you check the station’s elevation once a minute, how close (in seconds) can you get to the ' +
    'moment it rises above 10°? How many checks would plain bisection need to get within 0.05 s?',
)

const now = Date.now()
const obs = makeObserver(FREMONT)
for (const el of currentElements()) {
  const sat = satelliteJsPropagator.init(el)
  const pass = findPasses(sat, FREMONT, now, now + 7 * 86_400_000)[0]
  if (!pass) continue
  console.log(`${el.OBJECT_NAME}, next visible pass. Elevation every 60 s:`)
  const t0 = Math.floor(pass.start.unixMs / 60_000) * 60_000 - 3 * 60_000
  for (let t = t0; t <= pass.end.unixMs + 60_000; t += 60_000) {
    const sky = skyAt(t)
    const look = lookAtTeme(obs, sat.propagate(t).rTeme, sky.gmstRad)
    const bar = look.elDeg > 0 ? '█'.repeat(Math.round(look.elDeg / 3)) : ''
    console.log(`  ${fmt(t)}  ${look.elDeg.toFixed(1).padStart(6)}°  ${bar}`)
  }
  console.log(
    `Root-finder: visible from ${fmt(pass.start.unixMs)} (${pass.start.reason}) to ${fmt(pass.end.unixMs)} (${pass.end.reason}), peak ${pass.peak.elDeg.toFixed(1)}°`,
  )
  console.log(
    `Bisection from a 60 s bracket to 0.05 s needs log2(60/0.05) ≈ ${Math.ceil(Math.log2(60 / 0.05))} steps; Brent usually needs fewer.\n`,
  )
}
