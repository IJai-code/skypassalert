// Bottom navigation, the way a native app does it: four destinations, the
// current one in a pill.
import { IconCamera, IconPasses, IconSky, IconTonight } from './Icons.tsx'

export type Tab = 'tonight' | 'sky' | 'camera' | 'passes'

const TABS: Array<{
  id: Tab
  label: string
  Icon: (p: { className?: string }) => React.ReactNode
}> = [
  { id: 'tonight', label: 'Tonight', Icon: IconTonight },
  { id: 'sky', label: 'Sky', Icon: IconSky },
  { id: 'camera', label: 'Camera', Icon: IconCamera },
  { id: 'passes', label: 'Passes', Icon: IconPasses },
]

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-[26px] border border-white/10 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-1.5 shadow-[0_10px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onTab(id)}
                className={`flex w-full items-center justify-center gap-2 rounded-[20px] py-2.5 text-[0.8125rem] font-semibold transition-colors ${active ? 'bg-action text-action-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <Icon className="size-5" />
                <span className={active ? '' : 'sr-only sm:not-sr-only'}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
