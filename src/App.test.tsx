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
    expect(await screen.findByRole('heading', { name: /tonight in fremont/i })).toBeInTheDocument()
    expect(screen.getByText('7:32')).toBeInTheDocument()
    expect(screen.getByText(/tiangong, china’s space station/i)).toBeInTheDocument()
    const how = screen.getByRole('region', { name: /how to see it/i })
    expect(within(how).getByText(/rises low in the west-southwest/i)).toBeInTheDocument()
    expect(within(how).getByText(/where the sun went down/i)).toBeInTheDocument()
    expect(within(how).getByRole('button', { name: /find it in the sky/i })).toBeInTheDocument()
    expect(within(how).getByRole('button', { name: /sky camera/i })).toBeInTheDocument()
  })

  it('shows instrument readouts for the pass', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getAllByText('80°').length).toBeGreaterThan(0)
  })

  it('draws the live sky and a labelled sky map', async () => {
    render(<App />)
    expect(await screen.findByRole('img', { name: /sky map/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sky view facing/i })).toBeInTheDocument()
  })

  it('gives bearings in degrees from true north, with the magnetic equivalent', async () => {
    render(<App />)
    const which = await screen.findByRole('region', { name: /which way to look/i })
    expect(within(which).getByText(/245°/)).toBeInTheDocument()
    expect(within(which).getByText(/true north/i)).toBeInTheDocument()
  })

  it('switches to Sky Camera with targets from the sky model, and back', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    screen.getByRole('tab', { name: /camera/i }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole('tab', { name: /camera/i })).toHaveAttribute('aria-selected', 'true'),
    )
    expect(await screen.findByRole('button', { name: /take a stacked photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /phone camera/i })).toBeInTheDocument()
    screen.getByRole('tab', { name: /^sky$/i }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole('tab', { name: /^sky$/i })).toHaveAttribute('aria-selected', 'true'),
    )
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
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    const { default: axe } = await import('axe-core')
    // jsdom has no layout engine, so contrast is left to Lighthouse in CI.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
