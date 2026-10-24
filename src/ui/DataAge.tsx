// Every prediction says how old its orbit data is, with an honest note that
// grows with age. SGP4 errors grow roughly with time since the element epoch,
// and the ISS also reboosts without notice.
import { ago } from '../lib/format.ts'

export function DataAge({ epochMs, nowMs }: { epochMs: number; nowMs: number }) {
  const age = nowMs - epochMs
  const days = age / 86_400_000
  const note =
    days < 1.5
      ? 'Times should be right to within a few seconds.'
      : days < 4
        ? 'Times may be off by up to a minute; we refresh every 6 hours.'
        : 'This data is old. Times could be off by several minutes.'
  return (
    <p className="text-sm text-ink-3">
      <span
        aria-hidden="true"
        className={`mr-2 inline-block size-1.5 rounded-full align-middle ${days < 1.5 ? 'bg-ink-2' : 'bg-ink-3 ring-1 ring-ink-2'}`}
      />
      Orbit data from {ago(age)}. {note}
    </p>
  )
}
