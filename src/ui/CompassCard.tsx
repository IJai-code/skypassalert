// "Which way to look": the sky map as a compass. Shows true bearings in
// degrees and, on phones, turns live with the phone's compass so the arrow
// at the top is the way you're facing.
// Docs: docs/DESIGN.md#compass · Learn: docs/learn/11-compass.md
import { useEffect, useMemo, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { compass16 } from '../engine/describe/describe.ts'
import { declinationDeg } from '../engine/magnetic/wmm.ts'
import { useOrientation, requestMotionPermission } from '../sky/useOrientation.ts'
import { azEl } from '../sky/projection.ts'
import { SkyDome } from './SkyDome.tsx'

type Props = {
  pass: ForecastPass
  place: Place
  sunsetAzDeg: number | null
  nowMs: number
}

const canHaveCompass = () =>
  typeof window !== 'undefined' &&
  'DeviceOrientationEvent' in window &&
  (navigator.maxTouchPoints ?? 0) > 0

export function CompassCard({ pass, place, sunsetAzDeg, nowMs }: Props) {
  const decl = useMemo(() => declinationDeg(place.latDeg, place.lonDeg, nowMs), [place, nowMs])
  const [enabled, setEnabled] = useState(false)
  const sensors = useOrientation(enabled, decl)
  const [heading, setHeading] = useState<number | null>(null)

  // Sample the sensor camera at ~12 Hz for the dial.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      const cam = sensors.camRef.current
      if (!cam) return
      const f = azEl(cam.forward)
      // Flat on a table (camera pointing down): use where the top edge points.
      setHeading(f.elDeg < -45 ? azEl(cam.up).azDeg : f.azDeg)
    }, 80)
    return () => clearInterval(id)
  }, [enabled, sensors.camRef])

  const start = Math.round(pass.start.azDeg)
  const magnetic = Math.round((pass.start.azDeg - decl + 360) % 360)
  let turn: number | null = null
  if (heading !== null) {
    turn = pass.start.azDeg - heading
    if (turn > 180) turn -= 360
    if (turn < -180) turn += 360
  }

  return (
    <section aria-labelledby="which-way">
      <h2 id="which-way" className="label">
        Which way to look
      </h2>
      <SkyDome
        pass={pass}
        timeZone={place.timeZone}
        sunsetAzDeg={sunsetAzDeg}
        moon={pass.moonAtPeak}
        nowMs={nowMs}
        headingDeg={heading}
        className="mx-auto mt-4 max-w-[22rem] wide:mx-0"
      />
      <div className="tnum mt-4 space-y-1.5 text-[0.9375rem]">
        <p>
          Start facing <span className="font-semibold">{start}°</span> (
          {compass16(pass.start.azDeg)}), then follow it to{' '}
          <span className="font-semibold">{Math.round(pass.end.azDeg)}°</span> (
          {compass16(pass.end.azDeg)}). Highest point{' '}
          <span className="font-semibold">{Math.round(pass.peak.elDeg)}°</span> up.
        </p>
        {heading !== null && turn !== null && (
          <p
            aria-live="polite"
            className={Math.abs(turn) < 8 ? 'font-semibold text-station' : 'text-ink'}
          >
            {Math.abs(turn) < 8
              ? `You’re facing the right way (${Math.round(heading)}°).`
              : `You’re facing ${Math.round(heading)}°: turn ${turn > 0 ? 'right' : 'left'} ${Math.round(Math.abs(turn))}°.`}
          </p>
        )}
        <p className="text-sm text-ink-3">
          Bearings are from true north. A compass app set to magnetic north will read{' '}
          {Math.abs(decl).toFixed(0)}° {decl >= 0 ? 'less' : 'more'} here ({magnetic}° for the
          start).
        </p>
      </div>
      {canHaveCompass() && heading === null && sensors.status !== 'active' && (
        <button
          type="button"
          onClick={async () => {
            if (await requestMotionPermission()) setEnabled(true)
            else sensors.setStatus('denied')
          }}
          className="mt-4 rounded-md border border-hair-strong px-4 py-2.5 text-[0.9375rem] font-medium hover:bg-night-2"
        >
          Turn on live compass
        </button>
      )}
      {sensors.status === 'denied' && (
        <p className="mt-3 text-sm text-ink-3">
          Motion access was declined. On iPhone: Settings → Safari → Motion &amp; Orientation
          Access.
        </p>
      )}
    </section>
  )
}
