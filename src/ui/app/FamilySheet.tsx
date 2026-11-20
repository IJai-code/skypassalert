// Family settings in one small sheet: a bedtime (passes after it are listed
// but never headlined) and "simple words" for younger kids. Saved on this
// device only. Docs: docs/DESIGN.md#family
import { useEffect, useRef, useState } from 'react'
import { bedtimeLabel, type Family } from '../../lib/settings.ts'

export function FamilySheet({
  family,
  onChange,
  onClose,
}: {
  family: Family
  onChange: (f: Family) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [time, setTime] = useState(family.bedtime ?? '21:30')
  useEffect(() => {
    ref.current?.showModal?.()
  }, [])

  const set = (patch: Partial<Family>) => onChange({ ...family, ...patch })

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="family-title"
      className="m-auto mb-0 w-full max-w-lg border-t border-ink bg-night p-0 text-ink backdrop:bg-black/70 sm:mb-auto sm:border"
    >
      <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="flex items-baseline justify-between">
          <h2 id="family-title" className="serif text-[1.75rem] leading-tight">
            For the family
          </h2>
          <form method="dialog">
            <button type="submit" className="link mono text-[0.8125rem] text-ink-2">
              Done
            </button>
          </form>
        </div>

        <section aria-labelledby="bed" className="mt-5 border-t border-ink pt-3">
          <h3 id="bed" className="mono-caps text-ink-2">
            Bedtime
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-snug text-ink-2">
            Passes after bedtime stay in the list, marked “after bedtime”, but the top of the page
            only shows ones the kids can stay up for.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="mono flex items-center gap-3 text-[0.9375rem]">
              <span className="text-ink-2">Lights out at</span>
              <input
                type="time"
                value={time}
                step={300}
                onChange={(e) => {
                  setTime(e.target.value)
                  if (/^\d\d:\d\d$/.test(e.target.value)) set({ bedtime: e.target.value })
                }}
                className="border-b border-ink bg-transparent px-1 py-1 text-ink [color-scheme:dark]"
              />
            </label>
            <button
              type="button"
              aria-pressed={family.bedtime === null}
              onClick={() => set({ bedtime: family.bedtime === null ? time : null })}
              className={`link mono text-[0.875rem] ${family.bedtime === null ? 'text-station' : 'text-ink-2'}`}
            >
              {family.bedtime === null ? 'Any time (on)' : 'Any time'}
            </button>
          </div>
          <p className="mono mt-2 text-[0.75rem] text-ink-3">Now: {bedtimeLabel(family.bedtime)}</p>
        </section>

        <section aria-labelledby="words" className="mt-6 border-t border-rule pt-3">
          <h3 id="words" className="mono-caps text-ink-2">
            Simple words
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-snug text-ink-2">
            Shorter sentences for younger kids: “It goes almost right over your head, then
            disappears.” Same times, same directions.
          </p>
          <button
            type="button"
            aria-pressed={family.simpleWords}
            onClick={() => set({ simpleWords: !family.simpleWords })}
            className="link mt-3 text-[1rem]"
          >
            Simple words {family.simpleWords ? 'on' : 'off'}
          </button>
        </section>
        <p className="mt-6 text-[0.8125rem] text-ink-3">Saved on this phone only.</p>
      </div>
    </dialog>
  )
}
