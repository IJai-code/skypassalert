import { useEffect, useState } from 'react'
import type { Forecast } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { loadElements, type ElementsDoc } from './data.ts'
import { requestForecast } from './predict.ts'

/**
 * The current time. Ticks every second while a pass is close (countdowns,
 * live position), otherwise every 30 s to spare the battery; also on refocus.
 */
export function useNow(
  passes: ReadonlyArray<{ start: { unixMs: number }; end: { unixMs: number } }>,
): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = Date.now()
    const near = passes.some((p) => p.start.unixMs - t < 20 * 60_000 && p.end.unixMs > t - 60_000)
    const id = setTimeout(() => setNow(Date.now()), near ? 1000 : 30_000)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [passes, now])
  return now
}

export type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; forecast: Forecast; data: ElementsDoc }
  | { status: 'error'; message: string }

/** Load our published elements, then compute a week of passes in the worker. */
export function useForecast(place: Place, days = 8): ForecastState {
  const [state, setState] = useState<ForecastState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await loadElements()
        // Start a little in the past so a pass in progress is still in the list.
        const fromMs = Date.now() - 30 * 60_000
        const forecast = await requestForecast({ place, elements: data.objects, fromMs, days })
        if (!cancelled) setState({ status: 'ready', forecast, data })
      } catch (err) {
        if (!cancelled)
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [place, days])
  return state
}
