// Bottom navigation, set like the foot of a printed page: three words over a
// hairline, the current one underlined. Tonight (the almanac page), Sky (the
// live view, to find or photograph), Week (every pass for 8 days).
// Docs: docs/DESIGN.md#almanac
export type Tab = 'tonight' | 'sky' | 'week'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'sky', label: 'Sky' },
  { id: 'week', label: 'Week' },
]

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-night pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[36rem] px-2">
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onTab(id)}
                className={`mono-caps block w-full py-4 text-center text-[0.75rem] ${active ? 'link text-ink' : 'text-ink-3 hover:text-ink'}`}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
