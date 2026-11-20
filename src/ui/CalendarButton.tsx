// "Remind me": a one-pass .ics with a 10-minute alarm, made on the device.
// "Next two weeks": every good evening before bedtime in one file (D-032).
// In-app browsers (WeChat especially) often block file downloads, so there we
// show exact steps to reopen the page in the phone's real browser instead.
import { useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { stationName } from '../copy/en.ts'
import { calendarFor, goodEvenings, saveIcs } from '../lib/passIcs.ts'
import { detectInAppBrowser } from '../lib/env.ts'
import { InAppBrowserSheet } from './InAppBrowserSheet.tsx'

type Props = { pass: ForecastPass; placeName: string; timeZone: string }

function useDownload() {
  const [sheet, setSheet] = useState(false)
  const save = (make: () => [ics: string, filename: string]) => {
    if (detectInAppBrowser()) {
      setSheet(true)
      return
    }
    saveIcs(...make())
  }
  const sheetEl = sheet ? <InAppBrowserSheet onClose={() => setSheet(false)} /> : null
  return [save, sheetEl] as const
}

export function CalendarButton({ pass, placeName }: Props) {
  const [save, sheet] = useDownload()
  const name = stationName(pass.noradId).short
  return (
    <>
      <button
        type="button"
        onClick={() =>
          save(() => [
            calendarFor([pass], placeName, Date.now()),
            `${name.toLowerCase()}-${new Date(pass.start.unixMs).toISOString().slice(0, 10)}.ics`,
          ])
        }
        className="link"
      >
        Remind me
      </button>
      {sheet}
    </>
  )
}

/** Every good evening pass before bedtime for the next 14 days, in one file. */
export function TwoWeeksLink({
  passes,
  placeName,
  timeZone,
  bedtime,
  nowMs,
}: {
  passes: readonly ForecastPass[]
  placeName: string
  timeZone: string
  bedtime: string | null
  nowMs: number
}) {
  const [save, sheet] = useDownload()
  const good = goodEvenings(passes, nowMs, timeZone, bedtime)
  if (!good.length) return null
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() =>
          save(() => [calendarFor(good, placeName, Date.now()), 'skypassalert-next-two-weeks.ics'])
        }
        className="link text-left text-[1rem]"
      >
        Add the next 2 weeks to my calendar
      </button>
      <p className="mono mt-1 text-[0.75rem] text-ink-3">
        {good.length} good evening pass{good.length === 1 ? '' : 'es'}
        {bedtime ? ', all before bedtime' : ''}, each with a 10-minute alarm. Times more than 3 days
        out can shift by a few minutes.
      </p>
      {sheet}
    </div>
  )
}
