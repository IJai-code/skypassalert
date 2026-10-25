// The information sheet over the live sky. On phones it's a bottom sheet with
// three resting heights (peek / half / full); on wide screens it's a fixed
// side panel. Content scrolls inside it.
import { useRef, useState } from 'react'

export type SheetState = 'peek' | 'half' | 'full'

const HEIGHTS: Record<SheetState, string> = { peek: '18.5rem', half: '58dvh', full: '92dvh' }

export function Sheet({
  state,
  onState,
  hidden,
  children,
}: {
  state: SheetState
  onState: (s: SheetState) => void
  hidden: boolean
  children: React.ReactNode
}) {
  const start = useRef<{ y: number; h: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [dragH, setDragH] = useState<number | null>(null)

  const snap = (h: number) => {
    const vh = window.innerHeight
    const options: Array<[SheetState, number]> = [
      ['peek', 296],
      ['half', vh * 0.58],
      ['full', vh * 0.92],
    ]
    const best = options.reduce((a, b) => (Math.abs(b[1] - h) < Math.abs(a[1] - h) ? b : a))
    onState(best[0])
    setDragH(null)
  }

  return (
    <div
      ref={ref}
      className={`glass fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] border-t border-white/10 text-ink transition-[height,transform] duration-300 ease-out wide:inset-y-0 wide:right-0 wide:left-auto wide:h-auto! wide:w-[27rem] wide:rounded-none wide:border-t-0 wide:border-l ${hidden ? 'translate-y-full wide:translate-x-full wide:translate-y-0' : ''}`}
      style={{
        height: dragH !== null ? dragH : HEIGHTS[state],
        transitionProperty: dragH !== null ? 'none' : undefined,
      }}
    >
      <div
        className="flex shrink-0 touch-none justify-center pt-2.5 pb-1 wide:hidden"
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          start.current = { y: e.clientY, h: ref.current?.getBoundingClientRect().height ?? 0 }
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          setDragH(
            Math.max(
              120,
              Math.min(window.innerHeight * 0.95, start.current.h + (start.current.y - e.clientY)),
            ),
          )
        }}
        onPointerUp={(e) => {
          if (!start.current) return
          const moved = Math.abs(e.clientY - start.current.y)
          const h = dragH ?? start.current.h
          start.current = null
          setDragH(null)
          if (moved < 6) onState(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek')
          else snap(h)
        }}
      >
        <button
          type="button"
          aria-label={state === 'full' ? 'Show less' : 'Show more'}
          aria-expanded={state !== 'peek'}
          className="h-5 w-16 rounded-full"
          onClick={(e) => e.preventDefault()}
        >
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-white/35" />
        </button>
      </div>
      <div
        className={`min-h-0 flex-1 overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),20px)] wide:px-7 wide:pt-6 ${state === 'peek' ? 'overflow-hidden wide:overflow-y-auto' : 'overflow-y-auto'}`}
      >
        {children}
      </div>
    </div>
  )
}
