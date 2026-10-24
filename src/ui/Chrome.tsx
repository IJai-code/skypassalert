// Header and footer.
import { Logo } from '../brand/Logo.tsx'

const REPO = 'https://github.com/IJai-code/skypassalert'

export function Header({ placeName, dateLabel }: { placeName: string; dateLabel: string }) {
  return (
    <header className="flex items-center justify-between gap-4 py-4">
      <a href="/" className="flex items-center gap-2.5 rounded-sm" aria-label="SkyPassAlert home">
        <Logo size={26} title="" />
        <span className="text-[0.9375rem] font-semibold tracking-tight">SkyPassAlert</span>
      </a>
      <p className="text-right text-sm leading-tight">
        <span className="block font-medium text-ink">{placeName}</span>
        <span className="block text-ink-3">{dateLabel}</span>
      </p>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-hair pt-6 pb-10 text-sm leading-relaxed text-ink-3">
      <p className="max-w-prose">
        <span className="text-ink-2">Early preview for Fremont.</span> Choosing your own place,
        Chinese, share cards and two-week calendars arrive in v0.1.
      </p>
      <p className="mt-3 max-w-prose">
        Computed on your device by our open-source engine from CelesTrak orbital data. No ads, no
        accounts, no cookies, nothing about you leaves your phone. Predictions are estimates for
        sky-watching, not for safety-critical use.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <a
          className="underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href={`${REPO}/blob/main/docs/accuracy/phase2.md`}
        >
          How accurate is it?
        </a>
        <a
          className="underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href={REPO}
        >
          Source code
        </a>
        <a
          className="underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href="mailto:hello@skypassalert.com"
        >
          hello@skypassalert.com
        </a>
      </p>
    </footer>
  )
}
