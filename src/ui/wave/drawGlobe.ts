// Earth seen from above the station: a vertical-perspective projection
// (Snyder, "Map Projections: A Working Manual", §23) from a camera 2,600 km
// up, straight above the station. Day and night are shaded from the real Sun;
// the station's ground track, its horizon ring and your town sit on top.
// Pure drawing: no React here.
// Learn: docs/learn/14-wave-back.md
import { sunElevationAt, type LatLon, type OrbitSample } from '../../engine/sky/subpoint.ts'
import type { Earth } from './earth.ts'

const D = Math.PI / 180
const EARTH_KM = 6371
/** Camera distance from Earth's centre, in Earth radii (≈ 2,600 km up). */
const P = 1.41

export type GlobeView = {
  width: number
  height: number
  /** Point under the camera (the station's sub-point at the shown minute). */
  centre: LatLon
  /** Screen position of the centre, as fractions. */
  cx?: number
  cy?: number
}

export type Projector = {
  /** Screen point; `hidden` when on the far side (clamped to the limb). */
  project(p: LatLon): { x: number; y: number; hidden: boolean }
  /** Screen point → ground, or null off the disc. */
  invert(x: number, y: number): LatLon | null
  ox: number
  oy: number
  limbPx: number
}

export function projector(v: GlobeView): Projector {
  const limb = Math.sqrt((P - 1) / (P + 1))
  // The whole disc is 1.3× the screen width: the curve of the Earth shows at
  // top and bottom, the sides run off the screen like a window view.
  const limbPx = 0.65 * Math.min(v.width, v.height * 0.8)
  const S = limbPx / limb
  const ox = v.width * (v.cx ?? 0.5)
  const oy = v.height * (v.cy ?? 0.44)
  const p0 = v.centre.latDeg * D
  const l0 = v.centre.lonDeg * D
  const sp0 = Math.sin(p0)
  const cp0 = Math.cos(p0)

  const project = (p: LatLon) => {
    const ph = p.latDeg * D
    const dl = p.lonDeg * D - l0
    const cosc = sp0 * Math.sin(ph) + cp0 * Math.cos(ph) * Math.cos(dl)
    const k = (P - 1) / (P - cosc)
    let x = k * Math.cos(ph) * Math.sin(dl)
    let y = k * (cp0 * Math.sin(ph) - sp0 * Math.cos(ph) * Math.cos(dl))
    const hidden = cosc < 1 / P
    if (hidden) {
      const r = Math.hypot(x, y) || 1
      x = (x / r) * limb
      y = (y / r) * limb
    }
    return { x: ox + x * S, y: oy - y * S, hidden }
  }

  const invert = (sx: number, sy: number): LatLon | null => {
    const x = (sx - ox) / S
    const y = -(sy - oy) / S
    const rho = Math.hypot(x, y)
    if (rho >= limb) return null
    if (rho < 1e-9) return { ...v.centre }
    const root = 1 - (rho * rho * (P + 1)) / (P - 1)
    if (root < 0) return null
    const sinc = (P - Math.sqrt(root)) / ((P - 1) / rho + rho / (P - 1))
    const cosc = Math.sqrt(Math.max(0, 1 - sinc * sinc))
    const lat = Math.asin(cosc * sp0 + (y * sinc * cp0) / rho)
    const lon = l0 + Math.atan2(x * sinc, rho * cp0 * cosc - y * sp0 * sinc)
    return { latDeg: lat / D, lonDeg: ((((lon / D + 180) % 360) + 360) % 360) - 180 }
  }

  return { project, invert, ox, oy, limbPx }
}

export type GlobeScene = {
  earth: Earth | null
  subsolar: LatLon
  samples: readonly OrbitSample[]
  /** Visible part of the pass (thicker on the track). */
  passFrom: number
  passTo: number
  /** The minute shown. */
  station: OrbitSample
  you: LatLon & { label: string }
  red: boolean
}

type Pal = {
  space: string
  ocean: string
  land: string
  coast: string
  grid: string
  night: [number, number, number]
  twilight: [number, number, number]
  station: string
  you: string
  ink: string
  muted: string
}

// Engraved like an atlas plate (D-031): cream linework on the page's night
// paper, land a shade lighter than the sea, no glow.
const DAY: Pal = {
  space: '#0d1118',
  ocean: '#141b28',
  land: '#252c37',
  coast: 'rgba(233,228,214,0.75)',
  grid: 'rgba(233,228,214,0.12)',
  night: [4, 6, 10],
  twilight: [70, 52, 34],
  station: '#ffc65c',
  you: '#e9e4d6',
  ink: 'rgba(233,228,214,0.95)',
  muted: 'rgba(182,177,163,0.8)',
}
const RED: Pal = {
  space: '#000',
  ocean: '#2a0705',
  land: '#4a0d09',
  coast: 'rgba(200,50,40,0.35)',
  grid: 'rgba(200,50,40,0.1)',
  night: [0, 0, 0],
  twilight: [90, 15, 10],
  station: '#ff3b2e',
  you: '#c7362b',
  ink: 'rgba(210,55,44,0.95)',
  muted: 'rgba(150,36,28,0.85)',
}

/** How dark the ground is for a solar elevation: 0 in daylight, 0.82 at night. */
export function nightAlpha(sunElDeg: number): number {
  if (sunElDeg >= 0) return 0
  if (sunElDeg <= -12) return 0.82
  return (0.82 * -sunElDeg) / 12
}

let shade: HTMLCanvasElement | null = null

export function drawGlobe(ctx: CanvasRenderingContext2D, v: GlobeView, s: GlobeScene): Projector {
  const pal = s.red ? RED : DAY
  const pr = projector(v)
  // Marks and labels grow with the canvas, so the 1080 px share card reads like the phone view.
  const u = Math.max(1, v.width / 420)
  const { width: W, height: H } = v
  ctx.fillStyle = pal.space
  ctx.fillRect(0, 0, W, H)

  // Disc: ocean, ruled round its edge.
  ctx.save()
  ctx.beginPath()
  ctx.arc(pr.ox, pr.oy, pr.limbPx, 0, Math.PI * 2)
  ctx.fillStyle = pal.ocean
  ctx.fill()
  ctx.strokeStyle = pal.coast
  ctx.lineWidth = u
  ctx.stroke()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(pr.ox, pr.oy, pr.limbPx, 0, Math.PI * 2)
  ctx.clip()

  // Land.
  if (s.earth) {
    ctx.beginPath()
    for (const ring of s.earth.land) {
      for (let i = 0; i < ring.length; i += 2) {
        const q = pr.project({ lonDeg: ring[i]! / 10, latDeg: ring[i + 1]! / 10 })
        if (i === 0) ctx.moveTo(q.x, q.y)
        else ctx.lineTo(q.x, q.y)
      }
      ctx.closePath()
    }
    ctx.fillStyle = pal.land
    ctx.fill('evenodd')
    ctx.strokeStyle = pal.coast
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // Graticule every 30°.
  ctx.strokeStyle = pal.grid
  ctx.lineWidth = 1
  for (let lat = -60; lat <= 60; lat += 30)
    line(ctx, pr, (k) => ({ latDeg: lat, lonDeg: k }), -180, 180)
  for (let lon = -180; lon < 180; lon += 30)
    line(ctx, pr, (k) => ({ latDeg: k, lonDeg: lon }), -85, 85)

  // Night side from the real Sun, computed on a coarse grid and smoothed up.
  const step = 4
  shade ??= document.createElement('canvas')
  const sw = Math.ceil(W / step)
  const sh = Math.ceil(H / step)
  shade.width = sw
  shade.height = sh
  const sctx = shade.getContext('2d')
  if (sctx) {
    const img = sctx.createImageData(sw, sh)
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const g = pr.invert(i * step + step / 2, j * step + step / 2)
        if (!g) continue
        const e = sunElevationAt(g, s.subsolar)
        const a = nightAlpha(e)
        // A faint warm band along the line where the Sun is setting or rising.
        const band = e < 1 && e > -7 ? 1 - Math.abs(e + 3) / 4 : 0
        const c = band > 0 ? mix(pal.night, pal.twilight, band * 0.6) : pal.night
        const o = (j * sw + i) * 4
        img.data[o] = c[0]
        img.data[o + 1] = c[1]
        img.data[o + 2] = c[2]
        img.data[o + 3] = Math.round(255 * Math.max(a, band * 0.25))
      }
    sctx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(shade, 0, 0, sw * step, sh * step)
  }

  // The station's horizon: anyone inside this ring has it above their horizon.
  const reach = Math.acos(EARTH_KM / (EARTH_KM + s.station.heightKm)) / D
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = pal.muted
  ctx.lineWidth = 1
  circle(ctx, pr, s.station, reach)
  ctx.setLineDash([])

  // Ground track: amber where the station is sunlit, grey in Earth's shadow.
  for (let i = 1; i < s.samples.length; i++) {
    const a = s.samples[i - 1]!
    const b = s.samples[i]!
    const qa = pr.project(a)
    const qb = pr.project(b)
    if (qa.hidden || qb.hidden) continue
    const inPass = b.unixMs > s.passFrom && a.unixMs < s.passTo
    const lit = (a.sunlit + b.sunlit) / 2 > 0.5
    ctx.strokeStyle = lit ? pal.station : pal.muted
    ctx.globalAlpha = lit ? (inPass ? 1 : 0.55) : 0.5
    ctx.lineWidth = (inPass ? 3 : 1.5) * u
    ctx.setLineDash(lit ? [] : [2, 4])
    ctx.beginPath()
    ctx.moveTo(qa.x, qa.y)
    ctx.lineTo(qb.x, qb.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([])

  // You, and the line of sight to the station.
  const you = pr.project(s.you)
  const st = pr.project(s.station)
  if (!you.hidden) {
    ctx.strokeStyle = pal.you
    ctx.globalAlpha = 0.7
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(you.x, you.y)
    ctx.lineTo(st.x, st.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.fillStyle = pal.you
    ctx.beginPath()
    ctx.arc(you.x, you.y, 5 * u, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    label(ctx, s.you.label, you.x, you.y, pal.ink, st.x < you.x ? 1 : -1, u)
  }

  // The station at the shown minute.
  const lit = s.station.sunlit > 0.5
  ctx.save()
  if (lit) {
    ctx.shadowColor = pal.station
    ctx.shadowBlur = 18
  }
  ctx.fillStyle = lit ? pal.station : 'rgba(0,0,0,0.6)'
  ctx.strokeStyle = pal.station
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(st.x, st.y, 6.5 * u, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  ctx.restore()
  return pr
}

function mix(a: [number, number, number], b: [number, number, number], f: number) {
  return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * f)) as [number, number, number]
}

function line(
  ctx: CanvasRenderingContext2D,
  pr: Projector,
  at: (k: number) => LatLon,
  from: number,
  to: number,
) {
  ctx.beginPath()
  let pen = false
  for (let k = from; k <= to; k += 3) {
    const q = pr.project(at(k))
    if (q.hidden) {
      pen = false
      continue
    }
    if (pen) ctx.lineTo(q.x, q.y)
    else ctx.moveTo(q.x, q.y)
    pen = true
  }
  ctx.stroke()
}

/** A small circle of `radiusDeg` around a point on the ground. */
function circle(ctx: CanvasRenderingContext2D, pr: Projector, c: LatLon, radiusDeg: number) {
  const p = c.latDeg * D
  const l = c.lonDeg * D
  const r = radiusDeg * D
  ctx.beginPath()
  for (let b = 0; b <= 360; b += 4) {
    const bb = b * D
    const lat = Math.asin(Math.sin(p) * Math.cos(r) + Math.cos(p) * Math.sin(r) * Math.cos(bb))
    const lon =
      l +
      Math.atan2(
        Math.sin(bb) * Math.sin(r) * Math.cos(p),
        Math.cos(r) - Math.sin(p) * Math.sin(lat),
      )
    const q = pr.project({ latDeg: lat / D, lonDeg: lon / D })
    if (b === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  side: 1 | -1,
  u: number,
) {
  ctx.font = `500 ${Math.round(12 * u)}px 'Plex Mono', ui-monospace, Menlo, monospace`
  ctx.textAlign = side === 1 ? 'left' : 'right'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'
  ctx.strokeText(text, x + side * 10 * u, y)
  ctx.fillStyle = color
  ctx.fillText(text, x + side * 10 * u, y)
}
