// Choose where you're looking from. "Use my location" asks the browser for a
// position and keeps it on the phone; search runs on a bundled city list.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Place } from '../../engine/place.ts'
import {
  BAY_AREA_PICKS,
  cityLabel,
  loadCities,
  placeFromCity,
  placeFromPosition,
  searchCities,
  type CityDb,
} from '../../lib/places.ts'
import { IconPin } from './Icons.tsx'

export function PlacePicker({
  current,
  onPick,
  onClose,
}: {
  current: Place
  onPick: (p: Place) => void
  onClose: () => void
}) {
  const [db, setDb] = useState<CityDb | null>(null)
  const [query, setQuery] = useState('')
  const [geo, setGeo] = useState<'idle' | 'finding' | 'denied' | 'unavailable'>('idle')
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal?.()
    let alive = true
    void loadCities().then((d) => alive && setDb(d))
    return () => {
      alive = false
    }
  }, [])

  const results = useMemo(() => (db ? searchCities(db, query) : []), [db, query])
  const picks = useMemo(
    () =>
      db ? BAY_AREA_PICKS.map((id) => db.rows.find((r) => r[0] === id)).filter((r) => !!r) : [],
    [db],
  )

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeo('unavailable')
    setGeo('finding')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = db ?? (await loadCities())
        onPick(placeFromPosition(d, pos.coords.latitude, pos.coords.longitude, pos.coords.altitude))
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    )
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="place-title"
      className="m-auto mb-0 h-[85dvh] w-full max-w-lg rounded-t-[28px] bg-surface p-0 text-ink backdrop:bg-black/60 sm:mb-auto sm:h-[70dvh] sm:rounded-[28px]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="place-title" className="display text-xl">
            Where are you looking from?
          </h2>
          <form method="dialog">
            <button
              type="submit"
              className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-ink-2 ring-1 ring-hair"
            >
              Close
            </button>
          </form>
        </div>
        <p className="px-5 pt-1 text-sm text-ink-3">Now: {current.name}</p>

        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={useMyLocation}
            className="display flex w-full items-center justify-center gap-2 rounded-2xl bg-action py-3.5 text-action-ink"
          >
            <IconPin className="size-5" />
            {geo === 'finding' ? 'Finding you…' : 'Use my location'}
          </button>
          <p className="mt-2 text-xs text-ink-3">
            {geo === 'denied'
              ? 'Location access is off. Allow it in your browser settings, or search below.'
              : geo === 'unavailable'
                ? 'Couldn’t get a position. Search for your city instead.'
                : 'Your location stays on this phone. It’s never sent anywhere.'}
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Search for a city</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city, e.g. Fremont"
              autoComplete="off"
              className="w-full rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[1rem] text-ink ring-1 ring-hair outline-none placeholder:text-ink-3 focus:ring-action"
            />
          </label>
        </div>

        <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {(query.length >= 2 ? results : picks).map((row) => (
            <li key={row[0]}>
              <button
                type="button"
                onClick={() => db && onPick(placeFromCity(db, row))}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-white/[0.05]"
              >
                <span>{cityLabel(row)}</span>
                <span className="text-xs text-ink-3">
                  {row[9] >= 1e6
                    ? `${(row[9] / 1e6).toFixed(1)}M`
                    : `${Math.round(row[9] / 1000)}k`}
                </span>
              </button>
            </li>
          ))}
          {query.length < 2 && db && (
            <li className="px-3 pt-2 text-xs text-ink-3">
              Bay Area · type to search 8,000+ cities worldwide
            </li>
          )}
          {query.length >= 2 && db && !results.length && (
            <li className="px-3 py-3 text-ink-2">No match. Try a nearby larger city.</li>
          )}
          {!db && <li className="px-3 py-3 text-ink-3">Loading cities…</li>}
        </ul>
        <p className="px-5 pb-[max(env(safe-area-inset-bottom),14px)] text-[10px] text-ink-3">
          City data © GeoNames (CC BY 4.0)
        </p>
      </div>
    </dialog>
  )
}
