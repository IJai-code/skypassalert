// Draws one frame of the sky onto a 2D canvas: twilight colours from the real
// Sun altitude, real stars and patterns, Moon (with its lit side), planets,
// the horizon with compass points, and the station's path with minute marks.
// Used by the hero picture and by Sky View. Pure drawing: no React here.
// Learn: docs/learn/11-compass.md#renderer
import type { SkyScene } from '../engine/sky/scene.ts'
import type { StarCatalog } from '../engine/stars/stars.ts'
import { starColor } from '../engine/stars/stars.ts'
import { enu, project, type CameraBasis, type V3, type Viewport } from './projection.ts'

export type TrackPoint = { azDeg: number; elDeg: number; unixMs: number; magnitude: number }

export type DrawOptions = {
  vp: Viewport
  cam: CameraBasis
  scene: SkyScene
  catalog: StarCatalog | null
  /** Paint the sky gradient and ground (false when a camera feed is behind the canvas). */
  opaque: boolean
  /** Night (red) palette. */
  red: boolean
  track: readonly TrackPoint[] | null
  /** Station position to draw as a live dot, if any. */
  station: { azDeg: number; elDeg: number } | null
  formatMinute: (ms: number) => string
  /** Device pixel ratio already applied to the context transform. */
  labels: boolean
}

type Pal = {
  ink: string
  muted: string
  station: string
  ground: string
  groundLine: string
}

const PALETTE: Pal = {
  ink: 'rgba(236,239,247,0.92)',
  muted: 'rgba(169,178,204,0.75)',
  station: '#ffc65c',
  ground: '#05070f',
  groundLine: 'rgba(169,178,204,0.35)',
}
const RED: Pal = {
  ink: 'rgba(210,55,44,0.95)',
  muted: 'rgba(150,36,28,0.85)',
  station: '#ff3b2e',
  ground: '#000',
  groundLine: 'rgba(150,36,28,0.5)',
}

/** Sky colours (zenith, horizon, glow) for a Sun altitude: day → civil → nautical → night. */
export function skyColors(sunAltDeg: number): {
  zenith: string
  horizon: string
  glow: string
  glowStrength: number
} {
  const stops: Array<[number, [number, number, number], [number, number, number]]> = [
    [5, [52, 98, 170], [150, 182, 220]],
    [0, [38, 70, 135], [215, 150, 110]],
    [-4, [22, 40, 92], [170, 100, 90]],
    [-8, [12, 20, 52], [60, 55, 90]],
    [-12, [7, 11, 30], [24, 30, 62]],
    [-18, [5, 7, 18], [12, 16, 36]],
  ]
  const a = Math.max(-18, Math.min(5, sunAltDeg))
  let i = 0
  while (i < stops.length - 2 && a < stops[i + 1]![0]) i++
  const [a0, z0, h0] = stops[i]!
  const [a1, z1, h1] = stops[i + 1]!
  const f = (a0 - a) / (a0 - a1)
  const lerp = (p: number[], q: number[]) => p.map((v, k) => Math.round(v + (q[k]! - v) * f))
  const z = lerp(z0, z1)
  const h = lerp(h0, h1)
  return {
    zenith: `rgb(${z.join(',')})`,
    horizon: `rgb(${h.join(',')})`,
    glow: 'rgba(255,170,110,1)',
    glowStrength: Math.max(0, Math.min(1, (sunAltDeg + 14) / 14)) * (sunAltDeg > 2 ? 0.4 : 1),
  }
}

/** Faintest star shown for a Sun altitude (suburban sky, so never below ~4). */
export function limitingMagnitude(sunAltDeg: number): number {
  if (sunAltDeg > -1) return -1.5
  if (sunAltDeg > -6) return -1.5 + ((-1 - sunAltDeg) / 5) * 2.5 // 1.0 at civil dusk
  if (sunAltDeg > -12) return 1 + ((-6 - sunAltDeg) / 6) * 2.3
  return Math.min(4.3, 3.3 + ((-12 - sunAltDeg) / 6) * 1)
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function drawSky(ctx: CanvasRenderingContext2D, o: DrawOptions): void {
  const { vp, cam, scene } = o
  const pal = o.red ? RED : PALETTE
  const W = vp.width
  const H = vp.height
  const P = (v: V3) => project(v, cam, vp)
  ctx.clearRect(0, 0, W, H)

  // 1. Sky gradient, oriented along the projected vertical so it follows roll.
  if (o.opaque) {
    const c = skyColors(scene.sun.elDeg)
    const fAz = Math.atan2(cam.forward[0], cam.forward[1]) * (180 / Math.PI)
    const hz = P(enu(fAz, 0)) ?? { x: W / 2, y: H * 1.2 }
    const zen = P(enu(fAz, 60)) ?? { x: W / 2, y: -H }
    const g = ctx.createLinearGradient(hz.x, hz.y, zen.x, zen.y)
    g.addColorStop(0, o.red ? '#120302' : c.horizon)
    g.addColorStop(1, o.red ? '#000' : c.zenith)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Afterglow around where the Sun is (even when it's below the horizon).
    if (!o.red && c.glowStrength > 0.02) {
      const s = P(enu(scene.sun.azDeg, Math.max(scene.sun.elDeg, -2)))
      if (s) {
        const r = Math.max(W, H) * 0.9
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r)
        glow.addColorStop(0, `rgba(255,170,110,${0.55 * c.glowStrength})`)
        glow.addColorStop(0.35, `rgba(240,120,90,${0.18 * c.glowStrength})`)
        glow.addColorStop(1, 'rgba(240,120,90,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, W, H)
      }
    }
  }

  // 2. Stars, faint first so bright ones sit on top.
  const lim = limitingMagnitude(scene.sun.elDeg)
  if (o.catalog) {
    const { stars, lines, named } = o.catalog
    const pos: Array<{ x: number; y: number } | null> = new Array(stars.length).fill(null)
    for (let i = stars.length - 1; i >= 0; i--) {
      const el = scene.stars.el[i]!
      if (el < -1) continue
      const p = P(enu(scene.stars.az[i]!, el))
      if (!p) continue
      pos[i] = p
    }
    // Pattern lines under the stars.
    ctx.lineWidth = 1
    ctx.strokeStyle = o.red ? 'rgba(150,36,28,0.35)' : 'rgba(180,195,235,0.22)'
    for (const pairs of Object.values(lines)) {
      for (const [a, b] of pairs) {
        const pa = pos[a]
        const pb = pos[b]
        if (!pa || !pb) continue
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > Math.max(W, H)) continue
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.stroke()
      }
    }
    for (let i = 0; i < stars.length; i++) {
      const p = pos[i]
      const star = stars[i]!
      const mag = star[2]
      if (!p || mag > lim) continue
      const r = Math.max(0.55, 2.4 - 0.42 * mag) * (H / 800 + 0.4)
      const alpha = Math.max(0.25, Math.min(1, (lim - mag + 0.6) / 2.2))
      ctx.globalAlpha = alpha
      ctx.fillStyle = o.red ? pal.ink : starColor(star[3])
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (o.labels) {
      ctx.font = '500 11px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = pal.muted
      for (const [name, i] of Object.entries(named)) {
        const p = pos[i]
        if (!p || stars[i]![2] > Math.min(1.4, lim)) continue
        ctx.fillText(name, p.x + 6, p.y - 5)
      }
      // Pattern names at the centroid of their stars.
      for (const [name, pairs] of Object.entries(lines)) {
        const pts = [...new Set(pairs.flat())]
          .map((i) => pos[i])
          .filter((p): p is { x: number; y: number } => !!p)
        if (pts.length < 3 || lim < 2) continue
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
        if (cx < 0 || cx > W || cy < 0 || cy > H) continue
        ctx.fillStyle = o.red ? 'rgba(150,36,28,0.6)' : 'rgba(180,195,235,0.45)'
        ctx.font = 'italic 500 11px system-ui, -apple-system, sans-serif'
        ctx.fillText(name, cx + 10, cy + 18)
      }
    }
  }

  // 3. Planets and the Moon.
  ctx.font = '600 11px system-ui, -apple-system, sans-serif'
  for (const pl of scene.planets) {
    if (pl.elDeg < -1 || pl.magnitude > Math.max(lim, 1.5)) continue
    const p = P(enu(pl.azDeg, pl.elDeg))
    if (!p) continue
    ctx.fillStyle = o.red ? pal.ink : '#fff3d8'
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.8, 3.4 - 0.45 * pl.magnitude), 0, Math.PI * 2)
    ctx.fill()
    if (o.labels) {
      ctx.fillStyle = pal.ink
      ctx.fillText(pl.id[0]!.toUpperCase() + pl.id.slice(1), p.x + 8, p.y + 4)
    }
  }
  if (scene.moon.elDeg > -1) drawMoon(ctx, o, pal)

  // 4. Ground and horizon with compass points.
  drawHorizon(ctx, o, pal)

  // 5. The station's path, minute marks and live position.
  if (o.track) drawTrack(ctx, o, pal)
  if (o.station) {
    const p = P(enu(o.station.azDeg, o.station.elDeg))
    if (p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22)
      g.addColorStop(0, pal.station)
      g.addColorStop(1, 'rgba(255,198,92,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawMoon(ctx: CanvasRenderingContext2D, o: DrawOptions, pal: Pal) {
  const { scene } = o
  const p = project(enu(scene.moon.azDeg, scene.moon.elDeg), o.cam, o.vp)
  if (!p) return
  // Drawn ~3× its true 0.5° size so the phase reads at phone scale.
  const k = o.vp.height / 2 / Math.tan((o.vp.vfovDeg / 2) * (Math.PI / 180))
  const r = Math.max(7, Math.min(28, ((1.5 * Math.PI) / 180) * k * 0.5))
  // Direction on screen towards the Sun (lit side), from a point slightly sunward.
  const towards = project(
    enu(
      scene.moon.azDeg + Math.sin((scene.moon.brightLimbAngleDeg * Math.PI) / 180) * 2,
      scene.moon.elDeg + Math.cos((scene.moon.brightLimbAngleDeg * Math.PI) / 180) * 2,
    ),
    o.cam,
    o.vp,
  )
  const angle = towards ? Math.atan2(towards.y - p.y, towards.x - p.x) : 0
  const lit = scene.moon.illumination
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle)
  ctx.fillStyle = o.red ? 'rgba(80,15,10,0.9)' : 'rgba(40,44,60,0.9)'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // Lit part: half disc towards the Sun plus/minus an ellipse for the terminator.
  ctx.fillStyle = o.red ? pal.ink : '#f4f1e6'
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2)
  const e = r * (1 - 2 * lit) // ellipse half-width; negative = gibbous
  ctx.ellipse(0, 0, Math.abs(e), r, 0, Math.PI / 2, -Math.PI / 2, e > 0)
  ctx.fill()
  ctx.restore()
  if (o.labels) {
    ctx.fillStyle = pal.muted
    ctx.font = '500 11px system-ui, -apple-system, sans-serif'
    ctx.fillText('Moon', p.x + r + 6, p.y + 4)
  }
}

function drawHorizon(ctx: CanvasRenderingContext2D, o: DrawOptions, pal: Pal) {
  const { cam, vp } = o
  // Walk the horizon in azimuth order across the half of the sky in front of
  // the camera. (Sorting points by screen x zig-zags once the projection wraps,
  // which drew stray dark bands in early versions.)
  const fAz = (Math.atan2(cam.forward[0], cam.forward[1]) * 180) / Math.PI
  const pts: Array<{ x: number; y: number }> = []
  for (let d = -110; d <= 110; d += 2) {
    const p = project(enu(fAz + d, 0), cam, vp)
    if (p) pts.push(p)
  }
  if (o.opaque && pts.length > 1) {
    const fwdEl = Math.asin(cam.forward[2]) * (180 / Math.PI)
    if (fwdEl > -40) {
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      ctx.fillStyle = pal.ground
      ctx.beginPath()
      ctx.moveTo(first.x < last.x ? -10 : vp.width + 10, first.y)
      for (const p of pts) ctx.lineTo(p.x, p.y)
      ctx.lineTo(first.x < last.x ? vp.width + 10 : -10, last.y)
      ctx.lineTo(first.x < last.x ? vp.width + 10 : -10, vp.height + 10)
      ctx.lineTo(first.x < last.x ? -10 : vp.width + 10, vp.height + 10)
      ctx.closePath()
      ctx.fill()
    }
  }
  // Horizon line.
  ctx.strokeStyle = pal.groundLine
  ctx.lineWidth = 1
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
  // Degree ticks every 10°, compass letters every 45°.
  ctx.textAlign = 'center'
  for (let az = 0; az < 360; az += 10) {
    let rel = az - fAz
    rel = (((rel % 360) + 540) % 360) - 180
    if (Math.abs(rel) > 110) continue
    const p = project(enu(az, 0), cam, vp)
    if (!p || p.x < 0 || p.x > vp.width) continue
    const major = az % 45 === 0
    ctx.strokeStyle = pal.groundLine
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y + (major ? 9 : 5))
    ctx.stroke()
    if (major) {
      ctx.fillStyle = az === 0 ? pal.station : pal.ink
      ctx.font = '700 13px system-ui, -apple-system, sans-serif'
      ctx.fillText(COMPASS[az / 45]!, p.x, p.y + 25)
    } else if (o.labels && az % 30 === 0) {
      ctx.fillStyle = pal.muted
      ctx.font = '500 10px system-ui, -apple-system, sans-serif'
      ctx.fillText(`${az}°`, p.x, p.y + 22)
    }
  }
  ctx.textAlign = 'left'
}

function drawTrack(ctx: CanvasRenderingContext2D, o: DrawOptions, pal: Pal) {
  const track = o.track!
  const proj = track.map((t) => ({
    t,
    p: t.elDeg > -0.5 ? project(enu(t.azDeg, t.elDeg), o.cam, o.vp) : null,
  }))
  const brightest = Math.min(...track.map((t) => t.magnitude))
  ctx.lineCap = 'round'
  // Soft glow underneath, then the crisp line; opacity follows brightness.
  for (const pass of [
    { w: 9, a: 0.18 },
    { w: 2.6, a: 1 },
  ]) {
    for (let i = 1; i < proj.length; i++) {
      const a = proj[i - 1]!
      const b = proj[i]!
      if (!a.p || !b.p) continue
      const fade = Math.max(0.12, Math.min(1, 1 - (b.t.magnitude - brightest) / 3))
      ctx.strokeStyle = pal.station
      ctx.globalAlpha = pass.a * fade
      ctx.lineWidth = pass.w
      ctx.beginPath()
      ctx.moveTo(a.p.x, a.p.y)
      ctx.lineTo(b.p.x, b.p.y)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  // Minute marks with times.
  const first = track[0]!.unixMs
  const last = track[track.length - 1]!.unixMs
  ctx.font = '600 12px system-ui, -apple-system, sans-serif'
  for (let m = Math.ceil(first / 60_000) * 60_000; m <= last; m += 60_000) {
    const pos = interpolate(track, m)
    const next = interpolate(track, m + 2000)
    if (!pos || !next) continue
    const p = project(enu(pos.azDeg, pos.elDeg), o.cam, o.vp)
    const q = project(enu(next.azDeg, next.elDeg), o.cam, o.vp)
    if (!p || !q) continue
    const dx = q.x - p.x
    const dy = q.y - p.y
    const l = Math.hypot(dx, dy) || 1
    const nx = -dy / l
    const ny = dx / l
    ctx.strokeStyle = pal.station
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p.x - nx * 6, p.y - ny * 6)
    ctx.lineTo(p.x + nx * 6, p.y + ny * 6)
    ctx.stroke()
    if (o.labels) {
      ctx.fillStyle = pal.ink
      ctx.fillText(o.formatMinute(m), p.x + nx * 12 + 2, p.y + ny * 12 + 4)
    }
  }
  // Start ring and an arrowhead showing direction of travel.
  const s = proj.find((x) => x.p)
  if (s?.p) {
    ctx.strokeStyle = pal.station
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(s.p.x, s.p.y, 7, 0, Math.PI * 2)
    ctx.stroke()
  }
  const mid = Math.floor(proj.length * 0.55)
  const a = proj[mid]?.p
  const b = proj[mid + 1]?.p
  if (a && b) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(ang)
    ctx.fillStyle = pal.station
    ctx.beginPath()
    ctx.moveTo(7, 0)
    ctx.lineTo(-5, -5.5)
    ctx.lineTo(-5, 5.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

/** Position along a sampled track at time t (azimuth unwrapped). */
export function interpolate(
  track: readonly TrackPoint[],
  t: number,
): { azDeg: number; elDeg: number } | null {
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!
    const b = track[i]!
    if (t >= a.unixMs && t <= b.unixMs) {
      const f = (t - a.unixMs) / Math.max(1, b.unixMs - a.unixMs)
      let d = b.azDeg - a.azDeg
      if (d > 180) d -= 360
      if (d < -180) d += 360
      return { azDeg: (a.azDeg + f * d + 360) % 360, elDeg: a.elDeg + f * (b.elDeg - a.elDeg) }
    }
  }
  return null
}
