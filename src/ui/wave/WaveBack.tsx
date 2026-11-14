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
        { width: w, height: h, centre: st, cy: 0.5 },
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
      className="fixed inset-0 z-50 flex flex-col bg-night text-ink"
    >
      <div className="flex items-start justify-between gap-4 bg-night px-5 pt-[max(env(safe-area-inset-top),14px)] pb-3">
        <div className="min-w-0 flex-1 border-b border-ink pb-2">
          <p className="mono-caps text-ink-2">Their view · {formatDate(t, tz)}</p>
          <h2 id="wave-title" className="serif mt-1 text-[1.875rem] leading-none">
            Looking down from {name}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="link mono shrink-0 pt-1 text-[0.8125rem] text-ink-2"
        >
          Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Earth seen from above ${name} at ${formatTime(t, tz)}: ${sentence}`}
          className="absolute inset-0 block h-full w-full"
        />
      </div>

      <div className="border-t border-ink bg-night px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">
        <p className="serif tnum text-[2.5rem] leading-none">{formatTime(t, tz)}</p>
        <p
          className="serif-i mt-1.5 max-w-[34rem] text-[1.1875rem] leading-snug text-pretty"
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
        <div className="mono mt-1 flex justify-between text-[0.6875rem] text-ink-3">
          <span>{formatTime(from, tz)}</span>
          <span>Drag to fly the orbit</span>
          <span>{formatTime(to, tz)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <button
            type="button"
            onClick={() => void share()}
            disabled={sharing === 'busy'}
            className="link text-station disabled:no-underline"
          >
            {sharing === 'busy' ? 'Making your card…' : 'Share a wave card'}
          </button>
          <button type="button" onClick={onClose} className="link">
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
    <ul className="mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-ink-2">
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
        <span aria-hidden="true" className="inline-block size-2 rounded-full bg-ink" /> You
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
