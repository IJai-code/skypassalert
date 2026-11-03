// Wave Back: the same pass from the other side. Earth seen from above the
// station at the minute you look up, with day and night from the real Sun,
// the station's ground track and your town. It shows *why* you can see it:
// the station is still in sunlight while you stand in the dark.
// Learn: docs/learn/14-wave-back.md
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { subsolarPoint, sunElevationAt } from '../../engine/sky/subpoint.ts'
import { loadCities, type CityDb } from '../../lib/places.ts'
import { formatDate, formatTime } from '../../lib/format.ts'
import { stationName } from '../../copy/en.ts'
import { describeGround, loadEarth, type Earth } from './earth.ts'
import { drawGlobe } from './drawGlobe.ts'
import { shareWaveCard } from './waveCard.ts'
import { distanceKm, sampleAt, waveSentence } from './station.ts'

type Props = {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  red: boolean
  onClose: () => void
}

export default function WaveBack({ pass, place, catalog, red, onClose }: Props) {
  const samples = pass.station.samples
  const [t, setT] = useState(pass.peak.unixMs)
  const [earth, setEarth] = useState<Earth | null>(null)
  const [cities, setCities] = useState<CityDb | null>(null)
  const [sharing, setSharing] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const tz = place.timeZone
  const name = stationName(pass.noradId).short

  useEffect(() => {
    let live = true
    loadEarth().then(
      (e) => live && setEarth(e),
      () => {},
    )
    loadCities().then(
      (c) => live && setCities(c),
      () => {},
    )
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      live = false
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const st = useMemo(() => sampleAt(samples, t), [samples, t])
  const subsolar = useMemo(() => subsolarPoint(t), [t])
  const yourSun = sunElevationAt(place, subsolar)
  const ground = earth ? describeGround(earth, cities, st) : '…'
  const sentence = waveSentence({
    station: name,
    time: formatTime(t, tz),
    heightKm: st.heightKm,
    ground,
    placeName: place.name.split(',')[0] ?? place.name,
    distanceKm: distanceKm(place, st),
    sunlit: st.sunlit,
    yourSunDeg: yourSun,
  })

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
      drawGlobe(
        ctx,
        { width: w, height: h, centre: st, cy: 0.4 },
        {
          earth,
          subsolar,
          samples,
          passFrom: pass.start.unixMs,
          passTo: pass.end.unixMs,
          station: st,
          you: {
            latDeg: place.latDeg,
            lonDeg: place.lonDeg,
            label: place.name.split(',')[0] ?? '',
          },
          red,
        },
      )
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [st, subsolar, earth, samples, pass, place, red])

  const from = samples[0]?.unixMs ?? pass.start.unixMs
  const to = samples.at(-1)?.unixMs ?? pass.end.unixMs

  const share = async () => {
    setSharing('busy')
    try {
      const r = await shareWaveCard({
        pass,
        place,
        catalog,
        earth,
        subsolar: subsolarPoint(pass.peak.unixMs),
        station: sampleAt(samples, pass.peak.unixMs),
        caption: sentence,
      })
      setSharing(r === 'shared' ? 'idle' : 'saved')
    } catch {
      setSharing('error')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wave-title"
      className="fixed inset-0 z-50 bg-black text-ink"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Earth seen from above ${name} at ${formatTime(t, tz)}: ${sentence}`}
        className="absolute inset-0 block h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/80 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div>
          <p className="hud-caps text-ink-2">Their view · {formatDate(t, tz)}</p>
          <h2 id="wave-title" className="display mt-0.5 text-[1.5rem] leading-tight">
            Looking down from {name}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="glass grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-white/15"
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <p className="hud text-[3.25rem] leading-none font-semibold tracking-[-0.03em]">
          {formatTime(t, tz)}
        </p>
        <p
          className="mt-3 max-w-[34rem] text-[1.0625rem] leading-snug text-pretty"
          aria-live="polite"
        >
          {sentence}
        </p>
        <Legend />
        <label className="mt-4 block">
          <span className="sr-only">Time</span>
          <input
            type="range"
            min={from}
            max={to}
            step={5_000}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="w-full accent-[var(--station)]"
          />
        </label>
        <div className="mt-1 flex justify-between text-[0.75rem] text-ink-3">
          <span>{formatTime(from, tz)}</span>
          <span>Drag to fly the orbit</span>
          <span>{formatTime(to, tz)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => void share()}
            disabled={sharing === 'busy'}
            className="display flex items-center gap-2 rounded-full bg-action px-5 py-3 text-[0.9375rem] text-action-ink disabled:opacity-60"
          >
            {sharing === 'busy' ? 'Making your card…' : 'Share a wave card'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="display rounded-full bg-white/[0.08] px-5 py-3 text-[0.9375rem] ring-1 ring-white/15"
          >
            Back to your sky
          </button>
        </div>
        {sharing === 'saved' && (
          <p className="mt-2 text-[0.8125rem] text-ink-2">Saved to your downloads.</p>
        )}
        {sharing === 'error' && (
          <p className="mt-2 text-[0.8125rem] text-ink-2">
            Couldn’t make the card on this browser.
          </p>
        )}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-ink-2">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-station" /> In sunlight
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-4 border-t border-dashed border-ink-2"
        />{' '}
        In Earth’s shadow
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block size-2 rounded-full bg-action" /> You
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-full border border-dashed border-ink-2"
        />{' '}
        Its horizon
      </li>
    </ul>
  )
}
