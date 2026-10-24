// Lab: how fast does the sky turn compared with the clock?
// Learn: docs/learn/01-time.md#gmst
import { gmst82 } from '../../src/engine/time/sidereal.ts'
import { jdUt1 } from '../../src/engine/time/scales.ts'
import { predict } from './_lab.ts'

await predict(
  'After exactly 24 hours of clock time, has Earth turned exactly 360° relative to the stars? ' +
    'If not, how many more (or fewer) degrees, and how many minutes of clock time is that?',
)

const t0 = Date.parse('2026-10-24T00:00:00Z')
const t1 = t0 + 86_400_000
let turned = ((gmst82(jdUt1(t1)) - gmst82(jdUt1(t0))) * 180) / Math.PI
if (turned < 0) turned += 360
console.log(`In 24 h of clock time Earth turns 360° + ${turned.toFixed(4)}° relative to the stars.`)
const minutes = (turned / 360) * 24 * 60
console.log(
  `That extra ${turned.toFixed(3)}° takes ${minutes.toFixed(2)} min (${Math.floor(minutes)} min ${((minutes % 1) * 60).toFixed(0)} s).`,
)
console.log('\nWhy: in a year Earth turns 366.25 times relative to the stars but only 365.25 times')
console.log('relative to the Sun, because going around the Sun "uses up" one turn.')
console.log(`Check: 360° / 365.25 = ${(360 / 365.25).toFixed(4)}°.`)
console.log('\nSo the same star rises about 4 minutes earlier every night, and a pass prediction')
console.log(
  'that used the wrong rotation angle by just 1 s of time would put the observer ~0.4 km off.',
)
