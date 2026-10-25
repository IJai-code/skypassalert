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
    <footer className="mt-12 border-t border-hair pt-6 pb-8 text-[0.8125rem] leading-relaxed text-ink-3">
      <p className="max-w-prose">
        Free, open source, no ads, no accounts, no cookies. Predictions are computed on your phone;
        your location never leaves it. Estimates for sky-watching, not for safety-critical use.
      </p>
      <p className="mt-3 max-w-prose">
        Orbits: CelesTrak. Cities: © GeoNames (CC BY 4.0). Stars: Yale Bright Star Catalogue.
        Compass: NOAA World Magnetic Model. Photos: NASA (public domain; no endorsement implied).
      </p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <a
          className="text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href={`${REPO}/blob/main/docs/accuracy/phase2.md`}
        >
          How accurate is it?
        </a>
        <a
          className="text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href={REPO}
        >
          Source code
        </a>
        <a
          className="text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          href="mailto:hello@skypassalert.com"
        >
          hello@skypassalert.com
        </a>
      </p>
    </footer>
  )
}
