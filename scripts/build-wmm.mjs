// Converts NOAA's WMM2025.COF (public domain) into src/engine/magnetic/wmm2025.json.
// Usage: node scripts/build-wmm.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const lines = readFileSync(new URL('../data/fixtures/WMM2025.COF', import.meta.url), 'utf8').split(
  '\n',
)
const [epochStr, model] = lines[0].trim().split(/\s+/)
const terms = []
for (const l of lines.slice(1)) {
  const p = l.trim().split(/\s+/).map(Number)
  if (p.length < 6 || p[0] >= 9999) continue
  terms.push(p) // n, m, g, h, gdot, hdot
}
writeFileSync(
  new URL('../src/engine/magnetic/wmm2025.json', import.meta.url),
  JSON.stringify({ model, epoch: Number(epochStr), validUntil: 2030.0, terms }) + '\n',
)
console.log(`${model}: ${terms.length} terms, epoch ${epochStr}`)
