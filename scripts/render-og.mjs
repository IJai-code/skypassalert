// Renders the link-preview image (public/og.png, 1200×630) from an original
// SVG: the almanac's type and a star-atlas chart of a pass. No logos.
// resvg reads TTF, not woff2, so pass a folder of TTF copies of our fonts:
//   .venv/bin/python -c "from fontTools.ttLib import TTFont; ..."  (see docs/DESIGN.md#og-image)
//   node scripts/render-og.mjs <ttf-dir>
// Output is committed, so builds need no native dependency.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/render-og.mjs <ttf-dir>')

const W = 1200
const H = 630
const PAPER = '#0d1118'
const INK = '#e9e4d6'
const INK2 = '#b3ae9f'
const RULE = '#2a2f39'
const STATION = '#FFC65C'

// A chart in the same projection as PassChart: radius ∝ 90° − altitude.
const cx = 930
const cy = 330
const r = 210
const at = (az, el) => {
  const rr = (r * (90 - el)) / 90
  const a = (az * Math.PI) / 180
  return [cx + rr * Math.sin(a), cy - rr * Math.cos(a)]
}
// An illustrative evening pass: rises in the west-southwest, climbs to about
// 80° in the north-northwest, fades into Earth's shadow in the east-northeast.
// Drawn as a quadratic curve through those three points (a real path is close
// to a great circle, which this resembles on the chart).
const p0 = at(247, 0)
const pk = at(335, 80)
const p1 = at(62, 22)
const ctrl = [2 * pk[0] - (p0[0] + p1[0]) / 2, 2 * pk[1] - (p0[1] + p1[1]) / 2]
const q = (t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * ctrl[0] + t ** 2 * p1[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * ctrl[1] + t ** 2 * p1[1],
]
const path = `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`
const end = p1
const tail = q(1.12)
const dots = [0, 0.2, 0.4, 0.6, 0.8]
  .map((t) => q(t))
  .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${STATION}"/>`)
  .join('')
const cardinal = ['N', 'E', 'S', 'W']
  .map((n, k) => {
    const [x, y] = at(k * 90, -9)
    return `<text x="${x}" y="${y + 8}" text-anchor="middle" font-family="IBM Plex Mono" font-size="22" fill="${INK2}">${n}</text>`
  })
  .join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <line x1="72" y1="92" x2="${W - 72}" y2="92" stroke="${INK}" stroke-width="1.5"/>
  <text x="72" y="74" font-family="IBM Plex Mono" font-size="24" letter-spacing="2" fill="${INK}">SKYPASSALERT.COM</text>
  <text x="${W - 72}" y="74" text-anchor="end" font-family="IBM Plex Mono" font-size="24" letter-spacing="2" fill="${INK2}">ISS · TIANGONG</text>
  <text x="68" y="290" font-family="Instrument Serif" font-size="128" fill="${INK}">Look up</text>
  <text x="68" y="410" font-family="Instrument Serif" font-style="italic" font-size="128" fill="${INK}">tonight.</text>
  <text x="72" y="500" font-family="IBM Plex Mono" font-size="26" fill="${INK2}">When the space stations fly over you,</text>
  <text x="72" y="540" font-family="IBM Plex Mono" font-size="26" fill="${INK2}">in plain words. Free, no app, no account.</text>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${(r * 2) / 3}" fill="none" stroke="${RULE}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${r / 3}" fill="none" stroke="${RULE}" stroke-width="2"/>
  <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${RULE}" stroke-width="2"/>
  <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${RULE}" stroke-width="2"/>
  ${cardinal}
  <path d="${path}" fill="none" stroke="${STATION}" stroke-width="4" stroke-linecap="round"/>
  <path d="M${end[0].toFixed(1)} ${end[1].toFixed(1)} L${tail[0].toFixed(1)} ${tail[1].toFixed(1)}" fill="none" stroke="${STATION}" stroke-width="3" stroke-dasharray="5 7"/>
  ${dots}
</svg>`

const png = new Resvg(svg, {
  font: {
    fontFiles: ['instrument-serif.ttf', 'instrument-serif-italic.ttf', 'plex-mono-400.ttf'].map(
      (f) => join(dir, f),
    ),
    loadSystemFonts: false,
    defaultFontFamily: 'IBM Plex Mono',
  },
})
  .render()
  .asPng()
writeFileSync(new URL('../public/og.png', import.meta.url), png)
console.log(`og.png: ${png.length} bytes`)
