// Enforces the performance budget: JavaScript loaded by the initial route must
// stay under 150 KB gzipped (docs/ARCHITECTURE.md#performance-budget).
// "Initial" = the entry script plus every modulepreload in dist/index.html.
// Lazy chunks (city search, share card, etc.) are reported but not counted.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 150 * 1024
// The Flight's WebGL film loads on first touch; it has its own budget (D-033).
const FILM_BUDGET_BYTES = 40 * 1024
const dist = new URL('../dist/', import.meta.url).pathname

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const initial = new Set(
  [
    ...html.matchAll(
      /<(?:script[^>]*\bsrc|link[^>]*rel="modulepreload"[^>]*\bhref)="\/([^"]+\.js)"/g,
    ),
  ].map((m) => m[1]),
)
if (initial.size === 0) {
  console.error('check-bundle-size: no entry script found in dist/index.html')
  process.exit(1)
}

const gz = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

let total = 0
for (const file of initial) {
  const size = gz(file)
  total += size
  console.log(`initial  ${kb(size).padStart(9)}  ${file}`)
}
const lazy = readdirSync(join(dist, 'assets')).filter(
  (f) => f.endsWith('.js') && !initial.has(`assets/${f}`),
)
for (const f of lazy) console.log(`lazy     ${kb(gz(`assets/${f}`)).padStart(9)}  assets/${f}`)

console.log(`\nInitial JS: ${kb(total)} gzipped (budget ${kb(BUDGET_BYTES)})`)
if (total > BUDGET_BYTES) {
  console.error('Over budget. See docs/ARCHITECTURE.md#performance-budget.')
  process.exit(1)
}

const film = lazy.filter((f) => /^Flight-[\w-]+\.js$/.test(f))
if (film.length !== 1) {
  console.error(`check-bundle-size: expected one Flight chunk, found ${film.length}`)
  process.exit(1)
}
const filmSize = gz(`assets/${film[0]}`)
console.log(`Flight film: ${kb(filmSize)} gzipped (budget ${kb(FILM_BUDGET_BYTES)})`)
if (filmSize > FILM_BUDGET_BYTES) {
  console.error('The Flight chunk is over budget. See docs/ARCHITECTURE.md#performance-budget.')
  process.exit(1)
}
