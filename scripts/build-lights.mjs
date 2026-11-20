// Builds public/data/lights.json: Earth's night lights for the Flight's
// opening shot, from the GeoNames cities we already ship (CC BY 4.0, see
// ASSETS.md). Each city becomes one light: position to 0.1°, brightness from
// its population. A small file (the full city list is 712 KB) that the globe
// can paint in a few milliseconds.
//
// Usage: node scripts/build-lights.mjs
// Learn: docs/learn/16-the-flight.md#textures
import { readFileSync, writeFileSync } from 'node:fs'

const src = new URL('../public/data/cities.json', import.meta.url)
const out = new URL('../public/data/lights.json', import.meta.url)
const db = JSON.parse(readFileSync(src, 'utf8'))
const iLat = db.fields.indexOf('lat')
const iLon = db.fields.indexOf('lon')
const iPop = db.fields.indexOf('population')

// Brightness 1–9 from population, logarithmic: 15k → 1, ~10M → 9.
const level = (pop) =>
  Math.max(1, Math.min(9, Math.round((Math.log10(Math.max(pop, 15000)) - 4.1) * 3)))

const flat = []
for (const r of db.rows)
  flat.push(Math.round(r[iLat] * 10), Math.round(r[iLon] * 10), level(r[iPop]))
writeFileSync(
  out,
  JSON.stringify({
    source: `${db.source} → scripts/build-lights.mjs`,
    format: 'flat [lat×10, lon×10, brightness 1–9] per city',
    lights: flat,
  }),
)
console.log(`${flat.length / 3} lights → public/data/lights.json`)
