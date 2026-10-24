// Builds src/engine/time/eop-data.json (daily UT1 − UTC) from CelesTrak's
// EOP CSV (https://celestrak.org/SpaceData/EOP-Last5Years.csv).
// Usage: node scripts/build-eop.mjs <path-to-EOP.csv> [startDate=YYYY-MM-DD]
// Learn: docs/learn/01-time.md#ut1
import { readFileSync, writeFileSync } from 'node:fs'

const [csvPath, startArg] = process.argv.slice(2)
if (!csvPath) {
  console.error('usage: node scripts/build-eop.mjs <EOP.csv> [YYYY-MM-DD]')
  process.exit(1)
}

// Keep ~1 year of history (for tests and the accuracy archive) plus all predictions.
const start = startArg ?? new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)

const rows = readFileSync(csvPath, 'utf8').trim().split('\n')
const header = rows.shift()?.split(',') ?? []
const col = (name) => header.indexOf(name)
const [iDate, iMjd, iDut1] = [col('DATE'), col('MJD'), col('UT1-UTC')]
if ([iDate, iMjd, iDut1].includes(-1)) throw new Error('Unexpected EOP CSV header')

const kept = rows.map((r) => r.split(',')).filter((r) => r[iDate] >= start)
const startMjd = Number(kept[0][iMjd])
kept.forEach((r, i) => {
  if (Number(r[iMjd]) !== startMjd + i) throw new Error(`Gap in EOP data at ${r[iDate]}`)
})

const out = {
  source: `CelesTrak EOP (IERS), ${kept[0][iDate]} to ${kept.at(-1)[iDate]}`,
  startMjd,
  dut1: kept.map((r) => Number(Number(r[iDut1]).toFixed(5))),
}
writeFileSync(
  new URL('../src/engine/time/eop-data.json', import.meta.url),
  JSON.stringify(out) + '\n',
)
console.log(`${out.source}: ${out.dut1.length} days`)
