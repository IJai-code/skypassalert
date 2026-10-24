// The hero: what you'll actually see, drawn from your spot at the pass time.
// Twilight colour from the real Sun altitude, the real stars and planets in
// that direction, and the station's path with minute marks. Not decoration:
// every pixel comes from the prediction.
// Docs: docs/DESIGN.md#postcard
import { useEffect, useRef } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { skyScene } from '../engine/sky/scene.ts'
import type { StarCatalog } from '../engine/stars/stars.ts'
import { drawSky, interpolate } from '../sky/drawSky.ts'
import { basisLookingAt } from '../sky/projection.ts'
import { formatTime } from '../lib/format.ts'

type Props = {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  red: boolean
  /** Live time when the pass is under way (draws the station's current spot). */
  nowMs: number
  className?: string
  children?: React.ReactNode
}

/** Where to point the picture: towards the first part of the path, horizon near the bottom. */
export function postcardView(pass: ForecastPass) {
  const n = pass.track.length
  const lead = pass.track.slice(0, Math.max(2, Math.ceil(n * 0.55)))
  let x = 0
  let y = 0
  for (const p of lead) {
    x += Math.sin((p.azDeg * Math.PI) / 180)
    y += Math.cos((p.azDeg * Math.PI) / 180)
  }
  const az = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
  return { az, el: Math.max(22, Math.min(38, pass.peak.elDeg * 0.45)) }
}

export function Postcard({ pass, place, catalog, red, nowMs, className, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const live = nowMs >= pass.start.unixMs && nowMs <= pass.end.unixMs

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const view = postcardView(pass)
      // Wide, undistorted view: stereographic, ~115° across whatever the shape.
      const vfov = Math.max(72, Math.min(130, (115 * h) / Math.max(w, 1)))
      // Sky colour from the start of the pass; stars where they'll be at the peak.
      const scene = skyScene(place, pass.peak.unixMs, catalog)
      const startScene = skyScene(place, pass.start.unixMs, null)
      drawSky(ctx, {
        vp: { width: w, height: h, vfovDeg: vfov, projection: 'stereographic' },
        cam: basisLookingAt(view.az, view.el),
        scene: { ...scene, sun: startScene.sun },
        catalog,
        opaque: true,
        red,
        track: pass.track,
        station: live ? interpolate(pass.track, nowMs) : null,
        formatMinute: (ms) => formatTime(ms, place.timeZone).replace(/\s?[AP]M$/, ''),
        labels: true,
      })
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [pass, place, catalog, red, live, live ? Math.floor(nowMs / 1000) : 0]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapRef} className={`relative overflow-hidden bg-night ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Picture of the sky facing the ${Math.round(postcardView(pass).az)}° direction, showing the path the station will take, with minute marks.`}
        className="absolute inset-0 h-full w-full"
      />
      {children}
    </div>
  )
}
