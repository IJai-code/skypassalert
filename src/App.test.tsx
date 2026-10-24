import { render, screen, within } from '@testing-library/react'
import { App } from './App.tsx'
import { forecast } from './engine/predict.ts'
import type { ForecastRequest } from './engine/index.ts'
import stations from './engine/__fixtures__/stations-2026-10-24.json'

// The worker can't run in jsdom: compute on the main thread instead.
vi.mock('./lib/predict.ts', () => ({
  requestForecast: (req: ForecastRequest) => Promise.resolve(forecast(req)),
}))

beforeEach(() => {
  // Saturday 2026-10-24, 1:00 PM in Fremont.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T20:00:00Z'))
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ source: 'test', fetchedAt: '2026-10-24T08:52:00Z', objects: stations }),
        ),
      ),
    ),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('home screen', () => {
  it('leads with tonight’s best pass: time, object and a plain-language path', async () => {
    render(<App />)
    const answer = await screen.findByRole('region', { name: /tonight in fremont/i })
    expect(within(answer).getByText('7:32')).toBeInTheDocument()
    expect(within(answer).getByText(/tiangong, china’s space station/i)).toBeInTheDocument()
    expect(within(answer).getByText(/rises low in the west-southwest/i)).toBeInTheDocument()
    expect(within(answer).getByText(/where the sun went down/i)).toBeInTheDocument()
  })

  it('draws a labelled sky map of the pass', async () => {
    render(<App />)
    expect(await screen.findByRole('img', { name: /sky map/i })).toBeInTheDocument()
  })

  it('lists the week as a board and keeps pre-dawn passes separate', async () => {
    render(<App />)
    const week = await screen.findByRole('region', { name: /next 7 evenings/i })
    expect(within(week).getAllByRole('listitem').length).toBeGreaterThan(5)
    expect(within(week).getByRole('button', { name: /before-dawn passes/i })).toBeInTheDocument()
  })

  it('says how old the orbit data is', async () => {
    render(<App />)
    expect(await screen.findByText(/orbit data from/i)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<App />)
    await screen.findByRole('region', { name: /tonight in fremont/i })
    const { default: axe } = await import('axe-core')
    // jsdom has no layout engine, so contrast is left to Lighthouse in CI.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
