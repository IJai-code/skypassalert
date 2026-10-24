// Lab: when does the station vanish into Earth's shadow, and do the two
// shadow models agree? Learn: docs/learn/04-shadow.md
import { satelliteJsPropagator } from '../../src/engine/propagate/satellitejs-adapter.ts'
import { findPasses } from '../../src/engine/passes/finder.ts'
import { skyAt } from '../../src/engine/sky/sky.ts'
import { sunlitCylindrical, sunlitFractionConical } from '../../src/engine/shadow/shadow.ts'
import { FREMONT, currentElements, fmt, predict } from './_lab.ts'

await predict(
  'A pass ends because the station enters Earth’s shadow. Does it switch off instantly, or fade? ' +
    'If it fades, roughly how many seconds does the fade take for a station 400 km up?',
)

const now = Date.now()
for (const el of currentElements()) {
  const sat = satelliteJsPropagator.init(el)
  const pass = findPasses(sat, FREMONT, now, now + 7 * 86_400_000).find(
    (p) => p.end.reason === 'enters-shadow',
  )
  if (!pass) continue
  console.log(`${el.OBJECT_NAME}: pass ending in shadow at ${fmt(pass.end.unixMs)}`)
  let cylEdge: number | null = null
  let fadeStart: number | null = null
  let fadeEnd: number | null = null
  for (let t = pass.end.unixMs - 30_000; t < pass.end.unixMs + 30_000; t += 100) {
    const { rTeme } = sat.propagate(t)
    const sun = skyAt(t).sunTeme
    const f = sunlitFractionConical(rTeme, sun)
    if (cylEdge === null && sunlitCylindrical(rTeme, sun) === 0) cylEdge = t
    if (fadeStart === null && f < 0.999) fadeStart = t
    if (fadeEnd === null && f <= 0.001) fadeEnd = t
  }
  if (fadeStart && fadeEnd) {
    console.log(`  Conical model: starts dimming ${fmt(fadeStart)}, fully dark ${fmt(fadeEnd)}`)
    console.log(`  → the fade takes ${((fadeEnd - fadeStart) / 1000).toFixed(1)} s (the penumbra)`)
  }
  if (cylEdge && fadeStart && fadeEnd) {
    const mid = (fadeStart + fadeEnd) / 2
    console.log(
      `  Cylindrical model switches off at ${fmt(cylEdge)}: ${((cylEdge - mid) / 1000).toFixed(1)} s from the middle of the fade`,
    )
  }
  console.log('')
}
console.log(
  'Why it fades: seen from the station, the Sun is a disc ½° wide sliding behind Earth’s edge.',
)
console.log(
  'Part of the disc is hidden for a few seconds before all of it is (that’s the penumbra).',
)
