import { fireEvent, render, screen, within } from '@testing-library/react'
import { App } from './App.tsx'
import { forecast } from './engine/predict.ts'
import type { ForecastRequest } from './engine/index.ts'
import stations from './engine/__fixtures__/stations-2026-10-24.json'
import earth from '../public/data/earth-110m.json'

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
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('earth-110m')
              ? earth
              : url.includes('cities')
                ? { source: 'test', zones: ['America/Los_Angeles'], rows: [] }
                : { source: 'test', fetchedAt: '2026-10-24T08:52:00Z', objects: stations },
          ),
        ),
      ),
    ),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the app', () => {
  it('Tonight leads with the best pass: time, object, path and actions', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /tonight in fremont/i })).toBeInTheDocument()
    const hero = screen.getByRole('region', { name: /tonight in fremont/i })
    expect(within(hero).getByText('7:32')).toBeInTheDocument()
    expect(within(hero).getByText(/tiangong, china’s space station/i)).toBeInTheDocument()
    expect(within(hero).getByText(/rises low in the west-southwest/i)).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: /find it/i })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: /remind me/i })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: /their view/i })).toBeInTheDocument()
  })

  it('scrolls through the night: sunset, the pass, the planets, sunrise', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    expect(screen.getByRole('region', { name: /^sunset, 6:\d\d pm/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^tiangong, 7:32 pm/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^sunrise/i })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: /jump to a time tonight/i })
    expect(within(rail).getByRole('button', { name: /^tiangong, 7:32 pm/i })).toBeInTheDocument()
  })

  it('explains how to find a pass, anchored to sunset', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    const stop = screen.getByRole('region', { name: /^tiangong, 7:32 pm/i })
    expect(within(stop).getByText(/where the sun went down/i)).toBeInTheDocument()
  })

  it('shows the pass from the station: Earth below, why you can see it', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    const hero = screen.getByRole('region', { name: /tonight in fremont/i })
    fireEvent.click(within(hero).getByRole('button', { name: /their view/i }))
    const dialog = await screen.findByRole('dialog', { name: /looking down from tiangong/i })
    expect(await within(dialog).findByText(/km up, above/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/the sun is still shining on it/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('slider', { name: /time/i })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /back to your sky/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the live sky, with a switch to photograph', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    fireEvent.click(screen.getByRole('button', { name: /^sky$/i }))
    const sw = await screen.findByRole('tablist', { name: /sky view/i })
    fireEvent.click(within(sw).getByRole('tab', { name: /photograph/i }))
    expect(await screen.findByRole('button', { name: /take a stacked photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /phone camera/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^tonight$/i }))
    expect(await screen.findByRole('heading', { name: /tonight in fremont/i })).toBeInTheDocument()
  })

  it('lists the week, with evenings and before-dawn separated', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    fireEvent.click(screen.getByRole('button', { name: /^week$/i }))
    expect(await screen.findByRole('heading', { name: /^week$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /before dawn/i })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(4)
  })

  it('says how old the orbit data is', async () => {
    render(<App />)
    expect(await screen.findByText(/orbit data from/i)).toBeInTheDocument()
  })

  it('has no axe violations, on Tonight or in the station view', async () => {
    const { default: axe } = await import('axe-core')
    // jsdom has no layout engine, so contrast is left to Lighthouse in CI.
    const opts = { rules: { 'color-contrast': { enabled: false } } }
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    let results = await axe.run(container, opts)
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    const hero = screen.getByRole('region', { name: /tonight in fremont/i })
    fireEvent.click(within(hero).getByRole('button', { name: /their view/i }))
    await screen.findByRole('dialog')
    results = await axe.run(document.body, opts)
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
