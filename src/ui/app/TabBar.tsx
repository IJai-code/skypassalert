// Bottom navigation: three destinations. Tonight (the night as one scroll),
// Sky (the live view, to find or photograph), Week (every pass for 8 days).
import { IconPasses, IconSky, IconTonight } from './Icons.tsx'

export type Tab = 'tonight' | 'sky' | 'week'

const TABS: Array<{
  id: Tab
  label: string
  Icon: (p: { className?: string }) => React.ReactNode
}> = [
  { id: 'tonight', label: 'Tonight', Icon: IconTonight },
  { id: 'sky', label: 'Sky', Icon: IconSky },
  { id: 'week', label: 'Week', Icon: IconPasses },
]

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul className="glass pointer-events-auto flex w-full max-w-[22rem] items-center justify-between gap-1 rounded-full p-1.5 ring-1 ring-white/10 shadow-[0_10px_40px_rgb(0_0_0/0.5)]">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onTab(id)}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[0.8125rem] font-semibold transition-colors ${active ? 'bg-white/15 text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <Icon className="size-5" />
                <span>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
