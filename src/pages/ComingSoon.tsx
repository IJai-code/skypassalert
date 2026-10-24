// Phase 1 placeholder: says what SkyPassAlert will do, in the brand voice.
// Product brief: docs/PRODUCT.md. The sample line is clearly labelled as an
// example so nobody mistakes it for a real prediction.
import { Logo } from '../brand/Logo.tsx'
import { PassArc } from '../brand/PassArc.tsx'

const REPO_URL = 'https://github.com/IJai-code/skypassalert'
const CONTACT = 'hello@skypassalert.com'

const FEATURES = [
  {
    title: 'Tonight first, zero taps',
    body: 'Open the page and the best pass for your place is right at the top.',
  },
  {
    title: 'Plain words',
    body: 'When to step outside, which way to face, how high it climbs, how bright, how long.',
  },
  {
    title: 'Two space stations',
    body: 'The International Space Station and China’s Tiangong station.',
  },
  {
    title: 'Family mode',
    body: 'Only show passes before bedtime, with kid-friendly wording.',
  },
  {
    title: 'Share and remember',
    body: 'One-tap picture cards for group chats, and calendar reminders with no account.',
  },
  {
    title: 'English and 简体中文',
    body: 'More languages later.',
  },
] as const

export function ComingSoon() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pt-6 pb-10 sm:px-8">
      <header className="flex items-center gap-3">
        <Logo size={40} />
        <span className="text-xl font-semibold tracking-tight">SkyPassAlert</span>
      </header>

      <main className="flex-1">
        <section aria-labelledby="hero-title" className="pt-12 sm:pt-16">
          <PassArc className="mb-6 w-full max-w-md" />
          <h1
            id="hero-title"
            className="text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-7xl"
          >
            Look up tonight.
          </h1>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-night-line bg-night-raised px-4 py-1.5 text-base text-accent">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            Coming soon
          </p>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-muted text-pretty">
            A free, friendly way to see the space stations fly over you. No app, no account, no ads.
          </p>
        </section>

        <section
          aria-labelledby="example-title"
          className="mt-12 rounded-2xl border border-night-line bg-night-raised p-5 sm:p-6"
        >
          <h2 id="example-title" className="text-sm font-medium tracking-wide text-muted uppercase">
            What you’ll see (example only, not a real prediction)
          </h2>
          <p className="mt-3 text-2xl leading-snug font-semibold sm:text-3xl">
            Tonight in Fremont: <span className="text-accent">ISS at 7:42 PM.</span> Look NW, climbs
            to 62°, bright, 4 min.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            It looks like a steady, bright star gliding across the sky in a few minutes. It doesn’t
            blink. That’s how you tell it from a plane.
          </p>
        </section>

        <section aria-labelledby="features-title" className="mt-12">
          <h2 id="features-title" className="text-2xl font-semibold">
            What it will do
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-night-line/70 p-4">
                <p className="text-lg font-semibold">{f.title}</p>
                <p className="mt-1 text-base leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* zh-Hans copy: machine-drafted, needs native-speaker review (tracked in docs/STATUS.md). */}
        <section
          lang="zh-Hans"
          aria-label="中文简介"
          data-translation-status="needs-native-review"
          className="mt-12 border-l-2 border-accent pl-4"
        >
          <p className="text-2xl font-semibold">抬头看，今晚的星空。</p>
          <p className="mt-2 text-lg leading-relaxed text-muted">
            即将上线：用简单的话告诉你，国际空间站和中国空间站（天宫）什么时候从你头顶飞过、往哪个方向看。免费，无广告，无需注册。
          </p>
        </section>
      </main>

      <footer className="mt-16 border-t border-night-line pt-6 text-base leading-relaxed text-muted">
        <p>
          Free, open source, and built by a student in Fremont, CA. No ads, no accounts, no cookies,
          no personal data.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <a className="text-ink underline underline-offset-4 hover:text-accent" href={REPO_URL}>
            Source code on GitHub
          </a>
          <a
            className="text-ink underline underline-offset-4 hover:text-accent"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
        </p>
        <p className="mt-3 text-sm">
          Predictions will be estimates for sky-watching fun, not for safety-critical use.
        </p>
      </footer>
    </div>
  )
}
