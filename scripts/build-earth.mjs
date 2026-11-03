// Builds public/data/earth-110m.json for Wave Back: Natural Earth 1:110m land
// outlines (drawn on the globe) and named seas/oceans (to say "above the North
// Pacific"). Natural Earth is public domain; see ASSETS.md.
//
// Usage: node scripts/build-earth.mjs <dir with ne_110m_land.geojson and
// ne_110m_geography_marine_polys.geojson, from natural-earth-vector v5.1.2>
// Learn: docs/learn/14-wave-back.md
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('Pass the folder holding the Natural Earth GeoJSON files.')
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))

// Douglas–Peucker in degrees: a 110 m map drawn on a phone-sized globe never
// shows detail finer than ~0.15°.
function simplify(pts, tol) {
  if (pts.length < 4) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = pts[a]
    const [bx, by] = pts[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let best = -1
    let far = 0
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]
      const d = Math.abs(dy * (px - ax) - dx * (py - ay)) / len
      if (d > far) {
        far = d
        best = i
      }
    }
    if (far > tol && best > 0) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

// A closed ring starts and ends on the same point, which leaves Douglas–Peucker
// no baseline; split it at the vertex farthest from the start.
function simplifyRing(ring, tol) {
  const [x0, y0] = ring[0]
  let far = 1
  for (let i = 1; i < ring.length; i++)
    if (
      Math.hypot(ring[i][0] - x0, ring[i][1] - y0) >
      Math.hypot(ring[far][0] - x0, ring[far][1] - y0)
    )
      far = i
  return [...simplify(ring.slice(0, far + 1), tol).slice(0, -1), ...simplify(ring.slice(far), tol)]
}

// Flat integer arrays in tenths of a degree: [lon0, lat0, lon1, lat1, …].
const pack = (ring, tol) =>
  simplifyRing(ring, tol).flatMap(([lon, lat]) => [Math.round(lon * 10), Math.round(lat * 10)])

const polygons = (geom) =>
  geom.type === 'Polygon'
    ? [geom.coordinates]
    : geom.type === 'MultiPolygon'
      ? geom.coordinates
      : []

const land = []
for (const f of read('ne_110m_land.geojson').features)
  for (const poly of polygons(f.geometry)) {
    const ring = pack(poly[0], 0.15)
    if (ring.length >= 8) land.push(ring)
  }

const seas = []
for (const f of read('ne_110m_geography_marine_polys.geojson').features) {
  const p = f.properties
  // Title-case the oceans Natural Earth stores in capitals.
  const name = p.name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/ Of /g, ' of ')
  // Oceans are rank 0; named seas (rank 1) win when a point is in both.
  const rings = polygons(f.geometry)
    .map((poly) => pack(poly[0], 0.5))
    .filter((r) => r.length >= 8)
  seas.push({ name, rank: p.scalerank, rings })
}

const out = {
  source: 'Natural Earth 1:110m v5.1.2 (public domain), simplified',
  land,
  seas,
}
writeFileSync(new URL('../public/data/earth-110m.json', import.meta.url), JSON.stringify(out))
console.log(`land rings ${land.length}, seas ${seas.length}`)
