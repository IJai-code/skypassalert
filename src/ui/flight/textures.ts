// The globe's two textures, painted on the device from data we already ship:
//   surface: land and sea from Natural Earth's outlines, tinted by latitude
//            (ice towards the poles, dry belts around 25°), lit by the real Sun
//            in the shader.
//   night:   red = city lights (GeoNames cities, brightness from population),
//            green = 1 over the sea (for the Sun's glint on water).
// Both are equirectangular: x is longitude −180…180, y is latitude 90…−90.
// Learn: docs/learn/16-the-flight.md#textures
import type { Earth } from '../wave/earth.ts'

export const TEX_W = 2048
export const TEX_H = 1024

/** Longitude/latitude (degrees) → texture pixel. */
export const toPixel = (lonDeg: number, latDeg: number, w = TEX_W, h = TEX_H) => ({
  x: ((lonDeg + 180) / 360) * w,
  y: ((90 - latDeg) / 180) * h,
})

/** Brightness level (1–9, from scripts/build-lights.mjs) → light radius in pixels and strength. */
export const lightStyle = (level: number) => ({
  radius: 0.6 + level * 0.28,
  alpha: Math.min(0.95, 0.3 + level * 0.075),
})

type Canvas2D = CanvasRenderingContext2D

function landPath(ctx: Canvas2D, earth: Earth) {
  ctx.beginPath()
  for (const ring of earth.land) {
    for (let i = 0; i < ring.length; i += 2) {
      const p = toPixel(ring[i]! / 10, ring[i + 1]! / 10)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
  }
}

function canvas(): { c: HTMLCanvasElement; ctx: Canvas2D } | null {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const ctx = c.getContext('2d')
  return ctx ? { c, ctx } : null
}

/** Day-side colours: deep sea, land shading from green to dry to ice by latitude. */
export function paintSurface(earth: Earth): HTMLCanvasElement | null {
  const k = canvas()
  if (!k) return null
  const { c, ctx } = k
  const sea = ctx.createLinearGradient(0, 0, 0, TEX_H)
  sea.addColorStop(0, '#1b2b3d')
  sea.addColorStop(0.3, '#0c2340')
  sea.addColorStop(0.5, '#0a2a4a')
  sea.addColorStop(0.7, '#0c2340')
  sea.addColorStop(1, '#1b2b3d')
  ctx.fillStyle = sea
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  const land = ctx.createLinearGradient(0, 0, 0, TEX_H)
  const stops: Array<[number, string]> = [
    [90, '#e6ebef'], // ice
    [68, '#cfd6d4'],
    [60, '#4d5a43'], // boreal forest
    [40, '#5b6a45'],
    [28, '#8b7d58'], // dry belt
    [15, '#6f7442'],
    [0, '#3f5a32'], // tropics
    [-15, '#6a7140'],
    [-28, '#8a7a55'],
    [-45, '#58663f'],
    [-60, '#cfd6d4'],
    [-90, '#e6ebef'],
  ]
  for (const [lat, col] of stops) land.addColorStop((90 - lat) / 180, col)
  landPath(ctx, earth)
  ctx.fillStyle = land
  ctx.fill('evenodd')
  return c
}

/** City lights in red, the sea mask in green. */
export function paintNight(earth: Earth, lights: readonly number[]): HTMLCanvasElement | null {
  const k = canvas()
  if (!k) return null
  const { c, ctx } = k
  ctx.fillStyle = '#00ff00'
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  landPath(ctx, earth)
  ctx.fillStyle = '#000000'
  ctx.fill('evenodd')

  // Lights add up where cities crowd together, the way they do from orbit.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < lights.length; i += 3) {
    const p = toPixel(lights[i + 1]! / 10, lights[i]! / 10)
    const { radius, alpha } = lightStyle(lights[i + 2]!)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius)
    g.addColorStop(0, `rgba(255,0,0,${alpha})`)
    g.addColorStop(1, 'rgba(255,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2)
  }
  ctx.globalCompositeOperation = 'source-over'
  return c
}

let lightsCache: Promise<number[]> | null = null
/** Our own static file (scripts/build-lights.mjs). */
export function loadLights(): Promise<number[]> {
  lightsCache ??= fetch('/data/lights.json').then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json().then((d: { lights: number[] }) => d.lights)
  })
  return lightsCache
}
