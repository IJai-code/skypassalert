// Builds public/data/cities.json for the in-browser place search (no
// geocoding service, so nothing about where you are leaves your phone).
// Source: GeoNames cities15000 + admin1CodesASCII (CC BY 4.0, attribution
// in the footer and ASSETS.md). https://download.geonames.org/export/dump/
// Usage: node scripts/build-cities.mjs <cities15000.txt> <admin1CodesASCII.txt>
// Keeps every US city ≥ 15k people (launch audience) and the rest of the world ≥ 120k.
import { readFileSync, writeFileSync } from 'node:fs'

const [citiesPath, admin1Path] = process.argv.slice(2)
if (!citiesPath || !admin1Path) {
  console.error('usage: node scripts/build-cities.mjs cities15000.txt admin1CodesASCII.txt')
  process.exit(1)
}
const admin1 = new Map(
  readFileSync(admin1Path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))
    .map(([code, name]) => [code, name]),
)
const US_STATE = { CA: 'CA', NY: 'NY', TX: 'TX', WA: 'WA', OR: 'OR', NV: 'NV', AZ: 'AZ' } // short forms people type
const zones = []
const zoneIndex = new Map()
const rows = []
for (const line of readFileSync(citiesPath, 'utf8').split('\n')) {
  const f = line.split('\t')
  if (f.length < 19) continue
  const [id, name, ascii, , lat, lon, , , cc, , a1, , , , pop, elev, dem, tz] = f
  const population = Number(pop)
  if (!(cc === 'US' ? population >= 15_000 : population >= 120_000)) continue
  if (!zoneIndex.has(tz)) {
    zoneIndex.set(tz, zones.length)
    zones.push(tz)
  }
  const region = cc === 'US' ? (US_STATE[a1] ?? a1) : (admin1.get(`${cc}.${a1}`) ?? '')
  const elevation = Number(elev || dem) || 0
  rows.push([
    Number(id),
    name,
    ascii === name ? 0 : ascii,
    region,
    cc,
    +Number(lat).toFixed(4),
    +Number(lon).toFixed(4),
    Math.max(0, Math.round(elevation)),
    zoneIndex.get(tz),
    population,
  ])
}
rows.sort((a, b) => b[9] - a[9])
const out = {
  source: 'GeoNames cities15000 (CC BY 4.0), https://www.geonames.org/',
  fields: [
    'geonameId',
    'name',
    'asciiName',
    'region',
    'country',
    'lat',
    'lon',
    'elevationM',
    'zone',
    'population',
  ],
  zones,
  rows,
}
writeFileSync(new URL('../public/data/cities.json', import.meta.url), JSON.stringify(out))
console.log(`${rows.length} cities, ${zones.length} time zones`)
