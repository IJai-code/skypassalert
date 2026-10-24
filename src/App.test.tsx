import { render, screen } from '@testing-library/react'
import { App } from './App.tsx'

describe('Coming soon page', () => {
  it('leads with the tagline', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Look up tonight.' })).toBeInTheDocument()
  })

  it('labels the sample prediction as an example', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /example only/i })).toBeInTheDocument()
  })

  it('gives the logo an accessible name', () => {
    render(<App />)
    expect(screen.getByRole('img', { name: 'SkyPassAlert logo' })).toBeInTheDocument()
  })

  it('links to the contact address and the source code', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'hello@skypassalert.com' })).toHaveAttribute(
      'href',
      'mailto:hello@skypassalert.com',
    )
    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute(
      'href',
      'https://github.com/IJai-code/skypassalert',
    )
  })

  it('marks the Chinese section with its language and review status', () => {
    const { container } = render(<App />)
    const zh = container.querySelector('[lang="zh-Hans"]')
    expect(zh).not.toBeNull()
    expect(zh).toHaveAttribute('data-translation-status', 'needs-native-review')
  })
})

describe('Accessibility', () => {
  it('has no axe violations', async () => {
    const { default: axe } = await import('axe-core')
    const { container } = render(<App />)
    // jsdom has no layout engine, so contrast is left to Lighthouse in CI.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
