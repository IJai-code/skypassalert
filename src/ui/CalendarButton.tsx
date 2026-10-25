// "Remind me": a one-pass .ics with a 10-minute alarm, made on the device.
// In-app browsers (WeChat especially) often block file downloads, so there we
// show exact steps to reopen the page in the phone's real browser instead.
import { useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { compass8 } from '../engine/describe/describe.ts'
import { pathSentence, startCue, stationName } from '../copy/en.ts'
import { buildIcs } from '../lib/ics.ts'
import { detectInAppBrowser } from '../lib/env.ts'
import { InAppBrowserSheet } from './InAppBrowserSheet.tsx'
import { IconBell } from './app/Icons.tsx'

type Props = { pass: ForecastPass; placeName: string; timeZone: string }

export function CalendarButton({ pass, placeName }: Props) {
  const [sheet, setSheet] = useState(false)
  const name = stationName(pass.noradId).short

  const download = () => {
    if (detectInAppBrowser()) {
      setSheet(true)
      return
    }
    const ics = buildIcs({
      uid: `${pass.noradId}-${Math.round(pass.start.unixMs / 1000)}@skypassalert.com`,
      startMs: pass.start.unixMs,
      endMs: pass.end.unixMs,
      title: `${name} over ${placeName}: look ${compass8(pass.start.azDeg)}`,
      description: `${pathSentence(pass)} ${startCue(pass, null, false)} Times from SkyPassAlert; check the site for updates, orbits shift a little. https://skypassalert.com/?s=ics`,
      location: placeName,
      url: 'https://skypassalert.com/?s=ics',
      alarmMinutesBefore: 10,
    })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.toLowerCase()}-${new Date(pass.start.unixMs).toISOString().slice(0, 10)}.ics`
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <>
      <button
        type="button"
        onClick={download}
        className="display flex items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[0.9375rem] text-ink ring-1 ring-hair transition-colors hover:bg-white/10"
      >
        <IconBell className="size-4" /> Remind me
      </button>
      {sheet && <InAppBrowserSheet onClose={() => setSheet(false)} />}
    </>
  )
}
