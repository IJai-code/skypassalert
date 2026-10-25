// A still picture of the sky drawn from the real prediction: used as the
// hero card's background and as the picture for passes (Tiangong has no
// public-domain photo, so we draw its actual path instead).
import { useEffect, useRef } from 'react'
import type { ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { skyScene } from '../../engine/sky/scene.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { drawSky } from '../../sky/drawSky.ts'
import { basisLookingAt } from '../../sky/projection.ts'
import { formatTime } from '../../lib/format.ts'
import { postcardView } from '../stageView.ts'

type Props = {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  red?: boolean
  /** Fraction of the height where the horizon sits. */
  horizonAt?: number
  labels?: boolean
  className?: string
  label: string
}

export function SkyThumb({
  pass,
  place,
  catalog,
  red = false,
  horizonAt = 0.62,
  labels = true,
  className,
  label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const vfov = Math.max(80, Math.min(125, (110 * h) / Math.max(w, 1)))
      // Camera elevation that puts the horizon at `horizonAt` when the view
      // centre is drawn 22% higher (stereographic: y = 2k·tan(θ/2)).
      const centre = Math.max(0.15, horizonAt - 0.26)
      const q = (horizonAt - centre) * 2
      const el = (2 * Math.atan(q * Math.tan((vfov * Math.PI) / 720)) * 180) / Math.PI
      const scene = skyScene(place, pass.peak.unixMs, catalog)
      const start = skyScene(place, pass.start.unixMs, null)
      drawSky(ctx, {
        vp: { width: w, height: h, vfovDeg: vfov, projection: 'stereographic', cy: h * centre },
        cam: basisLookingAt(postcardView(pass).az, el),
        scene: { ...scene, sun: start.sun },
        catalog,
        opaque: true,
        red,
        track: pass.track,
        station: null,
        formatMinute: (ms) => formatTime(ms, place.timeZone).replace(/\s?[AP]M$/, ''),
        labels,
      })
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [pass, place, catalog, red, horizonAt, labels])
  // Decorative thumbnails (label "") are hidden from screen readers; the row says it in words.
  return label ? (
    <canvas ref={canvasRef} role="img" aria-label={label} className={className} />
  ) : (
    <canvas ref={canvasRef} aria-hidden="true" className={className} />
  )
}
