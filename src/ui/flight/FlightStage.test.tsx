import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { forecast } from '../../engine/predict.ts'
import type { OmmElements } from '../../engine/index.ts'
import elements from '../../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../../presets.ts'
import { passScore } from '../../engine/sky/schedule.ts'
import { FlightStage } from './FlightStage.tsx'

const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 8,
})
const pass = [...f.passes].sort((a, b) => passScore(b) - passScore(a))[0]!

const stage = () =>
  render(
    <FlightStage
      place={FREMONT}
      input={{ kind: 'pass', pass }}
      nowMs={pass.start.unixMs - 3_600_000}
      catalog={null}
      red={false}
      simple={false}
      labelledBy="answer"
      head={<p>head</p>}
      ground={<h1 id="answer">Tonight in Fremont</h1>}
    />,
  )

describe('the Flight stage', () => {
  const g = globalThis as { WebGL2RenderingContext?: unknown }
  const had = g.WebGL2RenderingContext
  beforeEach(() => {
    // Pretend the browser has WebGL2. jsdom's canvas still returns no context,
    // which is exactly the "WebGL2 exists but won't start" case.
    g.WebGL2RenderingContext = function WebGL2RenderingContext() {}
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })
  afterEach(() => {
    g.WebGL2RenderingContext = had
  })

  it('is a tall section named by the answer, with a scrub rail', () => {
    stage()
    const section = screen.getByRole('region', { name: 'Tonight in Fremont' })
    expect(section.style.height).toBe('320svh')
    const rail = screen.getByRole('slider', { name: /scrub through the pass/i })
    const seconds = Math.round((pass.end.unixMs - pass.start.unixMs) / 1000)
    expect(rail).toHaveAttribute('aria-valuemax', String(seconds))
  })

  it('the rail moves the page: scroll stays the one clock', () => {
    stage()
    const rail = screen.getByRole('slider', { name: /scrub through the pass/i })
    fireEvent.keyDown(rail, { key: 'ArrowDown' })
    fireEvent.keyDown(rail, { key: 'End' })
    expect(window.scrollTo).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(rail, { key: 'a' }) // other keys pass through
    expect(window.scrollTo).toHaveBeenCalledTimes(2)
  })

  it('keeps the still picture when the GPU won’t start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = stage()
    fireEvent.pointerDown(window)
    await waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no WebGL2/)))
    await waitFor(() => expect(container.querySelector('.flight-film')).toBeNull())
    expect(container.querySelector('.flight-poster')).not.toBeNull()
    warn.mockRestore()
  })
})
