// Builds src/engine/stars/bright-stars.json from the Yale Bright Star Catalogue
// (BSC5, Hoffleit & Warren 1991, CDS catalog V/50; data/fixtures/bsc5-catalog.dat).
// Keeps naked-eye stars down to mag 4.5 (enough to recognise patterns from a
// suburb) as compact [RA°, Dec°, Vmag, B−V] rows, J2000.
// Usage: node scripts/build-stars.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const LIMIT = 4.5
// Common names for the brightest and pattern stars, keyed by BSC "Name" field (Bayer).
const NAMES = {
  'Alp CMa': 'Sirius',
  'Alp Car': 'Canopus',
  'Alp Boo': 'Arcturus',
  'Alp Lyr': 'Vega',
  'Alp Aur': 'Capella',
  'Bet Ori': 'Rigel',
  'Alp CMi': 'Procyon',
  'Alp Ori': 'Betelgeuse',
  'Alp Aql': 'Altair',
  'Alp Tau': 'Aldebaran',
  'Alp Sco': 'Antares',
  'Alp Vir': 'Spica',
  'Bet Gem': 'Pollux',
  'Alp PsA': 'Fomalhaut',
  'Alp Cyg': 'Deneb',
  'Alp Leo': 'Regulus',
  'Alp Gem': 'Castor',
  'Alp UMi': 'Polaris',
  'Alp Eri': 'Achernar',
  'Bet Cen': 'Hadar',
  Alp1Cen: 'Rigil Kentaurus',
  Alp1Cru: 'Acrux',
  'Alp UMa': 'Dubhe',
  'Bet UMa': 'Merak',
  'Gam UMa': 'Phecda',
  'Del UMa': 'Megrez',
  'Eps UMa': 'Alioth',
  'Zet UMa': 'Mizar',
  'Eta UMa': 'Alkaid',
  'Gam Ori': 'Bellatrix',
  'Del Ori': 'Mintaka',
  'Eps Ori': 'Alnilam',
  'Zet Ori': 'Alnitak',
  'Kap Ori': 'Saiph',
  'Alp Cas': 'Schedar',
  'Bet Cas': 'Caph',
  'Gam Cas': 'Navi',
  'Del Cas': 'Ruchbah',
  'Eps Cas': 'Segin',
}
// Recognisable patterns, as pairs of names above.
const LINES = {
  'Big Dipper': [
    ['Alkaid', 'Mizar'],
    ['Mizar', 'Alioth'],
    ['Alioth', 'Megrez'],
    ['Megrez', 'Phecda'],
    ['Phecda', 'Merak'],
    ['Merak', 'Dubhe'],
    ['Dubhe', 'Megrez'],
  ],
  Orion: [
    ['Betelgeuse', 'Bellatrix'],
    ['Bellatrix', 'Mintaka'],
    ['Mintaka', 'Alnilam'],
    ['Alnilam', 'Alnitak'],
    ['Alnitak', 'Saiph'],
    ['Saiph', 'Rigel'],
    ['Rigel', 'Mintaka'],
    ['Betelgeuse', 'Alnitak'],
  ],
  Cassiopeia: [
    ['Caph', 'Schedar'],
    ['Schedar', 'Navi'],
    ['Navi', 'Ruchbah'],
    ['Ruchbah', 'Segin'],
  ],
  'Summer Triangle': [
    ['Vega', 'Deneb'],
    ['Deneb', 'Altair'],
    ['Altair', 'Vega'],
  ],
}

const rows = readFileSync(
  new URL('../data/fixtures/bsc5-catalog.dat', import.meta.url),
  'latin1',
).split('\n')
const field = (line, a, b) => line.slice(a - 1, b).trim()
const stars = []
const named = {}
for (const line of rows) {
  const vmag = Number.parseFloat(field(line, 103, 107))
  const rah = field(line, 76, 77)
  if (!rah || Number.isNaN(vmag)) continue // novae/non-stellar entries without J2000 position
  const name = NAMES[field(line, 5, 14).replace(/^\d+/, '').trim()]
  if (vmag > LIMIT && !name) continue
  const ra =
    (Number(rah) + Number(field(line, 78, 79)) / 60 + Number(field(line, 80, 83)) / 3600) * 15
  const sign = field(line, 84, 84) === '-' ? -1 : 1
  const dec =
    sign *
    (Number(field(line, 85, 86)) +
      Number(field(line, 87, 88)) / 60 +
      Number(field(line, 89, 90)) / 3600)
  const bv = Number.parseFloat(field(line, 110, 114))
  if (name) named[name] = stars.length
  stars.push([
    +ra.toFixed(3),
    +dec.toFixed(3),
    +vmag.toFixed(2),
    Number.isNaN(bv) ? 0.6 : +bv.toFixed(2),
  ])
}
const missing = Object.values(NAMES).filter((n) => !(n in named))
if (missing.length) throw new Error(`Names not found in BSC5: ${missing.join(', ')}`)
const lines = Object.fromEntries(
  Object.entries(LINES).map(([k, pairs]) => [k, pairs.map(([a, b]) => [named[a], named[b]])]),
)
const out = {
  source: 'Yale Bright Star Catalogue 5th ed. (CDS V/50), J2000, V ≤ ' + LIMIT,
  stars,
  named,
  lines,
}
writeFileSync(
  new URL('../src/engine/stars/bright-stars.json', import.meta.url),
  JSON.stringify(out) + '\n',
)
console.log(
  `${stars.length} stars, ${Object.keys(named).length} named, ${Object.keys(lines).length} patterns`,
)
