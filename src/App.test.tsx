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

describe('the app', () => {
  it('Tonight leads with the best pass: time, object, readouts and actions', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /tonight in fremont/i })).toBeInTheDocument()
    expect(screen.getByText('7:32')).toBeInTheDocument()
    expect(screen.getAllByText(/tiangong, china’s space station/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /find it in the sky/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remind me/i })).toBeInTheDocument()
  })

  it('explains how to see it, step by step', async () => {
    render(<App />)
    const how = await screen.findByRole('region', { name: /how to see it/i })
    expect(within(how).getByText(/rises low in the west-southwest/i)).toBeInTheDocument()
    expect(within(how).getByText(/where the sun went down/i)).toBeInTheDocument()
  })

  it('draws the pass on the real sky and on a compass map', async () => {
    render(<App />)
    expect(await screen.findByRole('img', { name: /the sky facing/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sky map/i })).toBeInTheDocument()
  })

  it('gives bearings in degrees from true north, with the magnetic equivalent', async () => {
    render(<App />)
    const which = await screen.findByRole('region', { name: /which way to look/i })
    expect(within(which).getByText(/245°/)).toBeInTheDocument()
    expect(within(which).getByText(/true north/i)).toBeInTheDocument()
  })

  it('opens Sky Camera from the tab bar, with a shutter and the phone-camera option', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    screen.getByRole('button', { name: /^camera$/i }).click()
    expect(await screen.findByRole('button', { name: /take a stacked photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /phone camera/i })).toBeInTheDocument()
    screen.getByRole('button', { name: /^tonight$/i }).click()
    expect(await screen.findByRole('heading', { name: /tonight in fremont/i })).toBeInTheDocument()
  })

  it('lists the week on the Passes tab, with evenings and before-dawn separated', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /tonight in fremont/i })
    screen.getByRole('button', { name: /^passes$/i }).click()
    expect(await screen.findByRole('heading', { name: /^passes$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /before dawn/i })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(4)
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
