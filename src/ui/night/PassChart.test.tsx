import { render, screen } from '@testing-library/react'
import { chartLabel, chartXY, minuteMarks, PassChart } from './PassChart.tsx'
import { forecast } from '../../engine/predict.ts'
import type { OmmElements } from '../../engine/index.ts'
import elements from '../../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../../presets.ts'

const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 8,
})
const shadowed = f.passes.find((p) => p.end.reason === 'enters-shadow')
const sets = f.passes.find((p) => p.end.reason === 'sets')
const minute = (ms: number) => new Date(ms).toISOString().slice(11, 16)

describe('the pass chart', () => {
  it('puts the zenith at the centre and north at the top, east to the right', () => {
    expect(chartXY(0, 90, 100)).toEqual({ x: 0, y: -0 })
    const north = chartXY(0, 0, 100)
    expect(north.x).toBeCloseTo(0)
    expect(north.y).toBeCloseTo(-100)
    const east = chartXY(90, 0, 100)
    expect(east.x).toBeCloseTo(100)
    expect(east.y).toBeCloseTo(0)
    expect(Math.hypot(...Object.values(chartXY(200, 30, 90)))).toBeCloseTo(60)
  })

  it('marks every whole minute of the visible path, in order', () => {
    const p = f.passes[0]
    expect(p).toBeDefined()
    if (!p) return
    const marks = minuteMarks(p)
    expect(marks.length).toBeGreaterThan(0)
    for (const m of marks) {
      expect(m.unixMs % 60_000).toBe(0)
      expect(m.unixMs).toBeGreaterThanOrEqual(p.start.unixMs)
      expect(m.unixMs).toBeLessThanOrEqual(p.end.unixMs)
      expect(m.elDeg).toBeGreaterThan(0)
    }
  })

  it('trails off dashed only when the station fades into Earth’s shadow', () => {
    expect(shadowed).toBeDefined()
    expect(sets).toBeDefined()
    if (!shadowed || !sets) return
    const { container, rerender } = render(
      <PassChart pass={shadowed} formatMinute={minute} label={chartLabel(shadowed)} />,
    )
    expect(container.querySelector('[data-part="shadow"]')).not.toBeNull()
    rerender(<PassChart pass={sets} formatMinute={minute} label={chartLabel(sets)} />)
    expect(container.querySelector('[data-part="shadow"]')).toBeNull()
  })

  it('describes itself in words, or hides when it is decoration', () => {
    const p = f.passes[0]
    if (!p) return
    const { rerender } = render(<PassChart pass={p} formatMinute={minute} label={chartLabel(p)} />)
    expect(
      screen.getByRole('img', { name: /sky chart of the path: starts in the/i }),
    ).toBeInTheDocument()
    rerender(<PassChart pass={p} formatMinute={minute} label="" labels={false} />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
