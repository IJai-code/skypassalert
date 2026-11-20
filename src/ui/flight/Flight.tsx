// The WebGL film over the stage (lazy chunk). It draws a frame only when the
// scroll position, the size or the data changes, and keeps its text labels
// (compass points, minute times, "You") as real DOM text placed by the same
// camera maths as the GPU.
// Learn: docs/learn/16-the-flight.md
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { loadEarth } from '../wave/earth.ts'
import {
  coastBuffer,
  frameAt,
  labelsAt,
  makeFilm,
  type Film,
  type FilmInput,
  type Label,
} from './film.ts'
import type { Progress } from './progress.ts'
import { createRenderer, type Renderer } from './renderer.ts'

type Props = {
  input: FilmInput
  progress: Progress
  red: boolean
  reduced: boolean
  paper: string
  formatMinute: (ms: number) => string
  stationShort: string
  onReady: () => void
  onFail: () => void
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default function Flight(props: Props) {
  const { input, progress, red, reduced, paper } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const film = useMemo(() => makeFilm(input), [input])
  // Latest props for the draw loop, which lives as long as the canvas does.
  const live = useRef({ ...props, film })
  useLayoutEffect(() => {
    live.current = { ...props, film }
  })
  const rendererRef = useRef<Renderer | null>(null)
  const coastFor = useRef<Film['world'] | null>(null)

  // One GPU context per canvas, for its whole life: a lost context can't be revived.
  useEffect(() => {
    const canvas = canvasRef.current
    const layer = labelsRef.current
    if (!canvas || !layer) return
    const r = createRenderer(canvas)
    if (!r) {
      console.warn('Flight: no WebGL2 here; keeping the still picture.')
      live.current.onFail()
      return
    }
    rendererRef.current = r
    let alive = true
    let announced = false
    let visible = true
    let filmShown: Film | null = null
    const spans = new Map<string, HTMLSpanElement>()

    const placeLabels = (labels: Label[]) => {
      const seen = new Set<string>()
      for (const l of labels) {
        seen.add(l.key)
        let el = spans.get(l.key)
        if (!el) {
          el = document.createElement('span')
          el.className = `flight-label flight-label-${l.kind} mono`
          el.textContent = l.text
          layer.appendChild(el)
          spans.set(l.key, el)
        }
        el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`
        el.style.opacity = l.alpha.toFixed(3)
      }
      for (const [k, el] of spans)
        if (!seen.has(k)) {
          el.remove()
          spans.delete(k)
        }
    }

    const askEarth = (f: Film) => {
      if (coastFor.current === f.world) return
      coastFor.current = f.world
      loadEarth()
        .then((earth) => {
          if (!alive || live.current.film.world !== f.world) return
          r.setCoast(coastBuffer(f.world, earth))
          progress.poke()
        })
        .catch(() => {}) // coastlines are a nicety; the globe still reads without them
    }

    const draw = (p: number) => {
      if (!alive || !visible) return
      const o = live.current
      if (filmShown !== o.film) {
        filmShown = o.film
        r.setFilm(o.film)
      }
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const screen = { width: w, height: h }
      // Phones: 1.5× is sharp enough for hairlines and spares the battery.
      const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2)
      const f = frameAt(o.film, p, screen, o.reduced)
      if (!r.draw(f, { width: w, height: h, dpr, red: o.red, paper: rgb(o.paper) })) {
        alive = false
        console.warn('Flight: the GPU context was lost; keeping the still picture.')
        o.onFail()
        return
      }
      placeLabels(
        labelsAt(o.film, f, screen, { formatMinute: o.formatMinute, stationShort: o.stationShort }),
      )
      if (o.film.pass && p > 0.25) askEarth(o.film)
      if (!announced) {
        if (r.ready()) {
          announced = true
          o.onReady()
        } else {
          // Shaders still compiling on another thread: look again next frame.
          requestAnimationFrame(() => progress.poke())
        }
      }
    }

    const unsub = progress.subscribe(draw)
    const ro = new ResizeObserver(() => progress.poke())
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting
      if (visible) progress.poke()
    })
    io.observe(canvas)
    return () => {
      alive = false
      unsub()
      ro.disconnect()
      io.disconnect()
      for (const el of spans.values()) el.remove()
      r.dispose()
      rendererRef.current = null
    }
  }, [progress])

  // New pass, red light, motion setting: redraw once.
  useEffect(() => progress.poke(), [progress, film, red, reduced, paper])

  return (
    <>
      <canvas ref={canvasRef} className="flight-film" aria-hidden="true" />
      <div ref={labelsRef} className="flight-labels" aria-hidden="true" />
    </>
  )
}
