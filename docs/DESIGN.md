# Design

How SkyPassAlert looks, sounds and behaves, and why. Every rule traces to something we observed or measured. Last reviewed 2026-10-24 (Phase 2).

## 1. What we learned from looking at the field

We used competitors on a phone-sized screen (375 px) on 2026-10-24. Sources and dates are in `docs/MARKET.md`.

| Observation | Lesson → rule |
|---|---|
| orbitalradar.com's city page showed a **blank first screen** until scripts loaded, then a card grid with emoji icons and a neon gradient button. | First paint must already say what the page is about (§5, Loading). No emoji, no gradients. |
| The same page said **"YES — VISIBLE TONIGHT ✅"** for a pass at **5:17 AM**. | "Tonight" means the evening. Pre-dawn passes are listed separately and never become the headline (`src/lib/state.ts`). |
| Heavens-Above is accurate and trusted, but its pass table is a dense desktop grid that overflows a phone, with raw "WNW 10°". | Keep the precision and lose the jargon: words first ("west-northwest, one fist up"), degrees second. |
| See A Satellite Tonight asks for a location before showing anything. | Zero taps to the first answer (the 3-second rule). |
| NASA's Spot the Station app, Night Sky and Sky Guide do AR camera views natively. | Don't fight native apps on AR. Win on speed, clarity and sharing (§7). |
| **Flighty** (Apple Design Award 2023, Interaction) presents dense flight data with airport-signage calm and moves through context-aware states with a countdown. | Our model: a **departure board for the sky**. One big time, states that change as the pass approaches, columns that line up. |
| **Sky Guide** (Apple Design Award 2014) has a red night mode. | Red night mode for the moments you're outside. |

Real data that shaped the product: this week in Fremont, every visible ISS pass is before dawn, while Tiangong passes almost every evening. Our `npm run lab:seasons` estimates that over the next 8 weeks the ISS alone gives a worthwhile evening pass on ~30% of evenings, Tiangong ~38%, and **either ~68%**. Showing both stations isn't a bonus feature; it is the difference between "nothing tonight" and "go outside at 7:32".

## 2. Principles
1. **Answer first.** The top of the screen is a sentence a parent can act on in three seconds.
2. **Computed, never decorative.** Every graphic (sky map, tonight strip, brightness dots) is drawn from the real prediction. If it doesn't encode data, it doesn't ship.
3. **Calm.** Hairlines, not boxes. Hierarchy from size and weight. Motion only to replay the real pass.
4. **Honest.** Data age on every prediction. Examples are labelled as examples. Low, faint passes stay listed but recede visually.
5. **Human units.** Fists at arm's length (~10°), "where the sun went down", "brighter than any star".

## 3. Anti-patterns (banned)
These are recognizable tells of generated, templated UIs; several were in our own Phase 1 page.

- Centered marketing hero with a tagline and a pill badge.
- Grids of identical icon cards ("features").
- Emoji or decorative icons standing in for content.
- Gradient text or gradient buttons; purple-blue "AI" gradients anywhere.
- The same large border-radius on every element.
- Looping decorative animation (our Phase 1 hero dot is gone).
- Vague copy ("Discover the cosmos!"). Write the specific thing.

## 4. Tokens (`src/index.css`)
| Token | Value | Meaning |
|---|---|---|
| `--night` | `#080c1a` | page |
| `--night-2` | `#0d1326` | the sky map disc, hovered rows |
| `--hair` / `--hair-strong` | 16% / 30% blue-grey | dividers, outlines |
| `--ink` / `--ink-2` / `--ink-3` | `#eceff7` / `#a9b2cc` / `#737c99` | primary / secondary / labels |
| **`--station`** | `#ffc65c` | **the station, and nothing else**: its dot, its path, its bar on the timeline |
| `--sky-day` … `--sky-astro` | four blues | sky darkness on the tonight strip |

**Night mode** (`:root[data-mode='night']`) redefines every token as a dim red on black. Eyes need about 30 minutes to fully dark-adapt, and a second of bright light sets that back; red light disturbs it far less. It's offered automatically in the "get ready" and "look now" states.

**Type.** System fonts (SF Pro on Apple, Roboto on Android, PingFang/Noto for Chinese): zero bytes, native feel. Times use tabular figures (`.tnum`) so they line up like a departure board. One very large time per screen (`clamp(4rem, 19vw, 6.5rem)`). The small uppercase `.label` style is used only for section names.

## 5. Components
- **Answer** (`src/ui/Answer.tsx`). States driven by `src/lib/state.ts`:
  - **tonight:** "Tonight in Fremont, CA" · big time · station name · one path sentence · cues (where to start relative to sunset, brightness and duration, why it fades).
  - **get-ready** (≤ 15 min): countdown, "head outside now", red-light offer.
  - **look-now:** "Look west-northwest, 2 fists up", live position on the map.
  - **just-ended:** "Did you catch it?", next one.
  - **not-tonight:** an honest explanation, plus the next good look.
  - **Loading:** the same shapes, so there's no layout shift (Lighthouse CLS 0) and the page is never blank.
- **Which way to look** (`CompassCard.tsx`): the sky map doubles as a compass dial, with a degree ring. With "live compass" on, it turns with the phone and says "turn left 35°". Bearings are true north, with the magnetic equivalent alongside.
- **Sky map** (`SkyDome.tsx`). Polar plot: edge = horizon, centre = straight up, **north up and east right** (map convention; star charts put east on the left, which confuses non-astronomers). It shows:
  - Altitude rings at 30° and 60°.
  - Where the sun set, and the Moon if it's up at the peak.
  - The path, with brightness encoded as opacity (dimming toward the horizon and into shadow).
  - Start, peak and end markers.
  - Labels that place themselves to avoid collisions.
  - **Replay** animates the real path (off under reduced motion).
- **Tonight strip** (`TonightStrip.tsx`). Sunset → full dark on one line, colored by real twilight times, with the pass as an amber bar and a dashed bedtime line (9:30 PM default).
- **Week board** (`WeekBoard.tsx`). Rows of day, time, station, height (degrees and fists), brightness dots and direction. Tap a row to show that pass at the top. Before-dawn passes sit behind a "for early risers" toggle.
- **Also tonight** (`AlsoTonight.tsx`). Moon phase and position, plus naked-eye planets with "highest around…". There's always something to look at.
- **Remind me** (`CalendarButton.tsx`). A one-pass `.ics` with a 10-minute alarm, made on the device. In in-app browsers it opens step-by-step instructions instead (§6).
- **Take it outside** (`TakeItOutside.tsx`). Desktop only: QR code to carry the page to a phone.

## 6. Device support
The build target is Vite's `baseline-widely-available`: Chrome/Edge 111+, Firefox 114+, Safari 16.4+.

| Tier | Who | Experience |
|---|---|---|
| Full | iPhone 8 or newer on iOS 16.4+; Android with current Chrome or Samsung Internet; recent desktop browsers | Everything |
| Nudge | In-app browsers: WeChat (`MicroMessenger`), Facebook, Instagram, LINE | Everything readable. Calendar downloads show exact "open in your browser" steps (WeChat: ··· → 在浏览器打开). Never a wall. |
| Handoff | Laptops/desktops | Two-column layout plus the QR "take it outside" panel |
| Unsupported | iOS ≤ 16.3 (iPhone 7 and older stop at iOS 15), old Android WebViews, IE, KaiOS, TVs, JS disabled | A static page inside `index.html`, shown by an ES3-safe feature check (Worker, `structuredClone`, `Array.prototype.at`, lookbehind regex (Safari 16.4), `Intl` time zones) or `<noscript>`. It explains what works, shows a QR code and the URL, describes what you'll get with a labelled example, and includes a Chinese paragraph. |

We test the unsupported path by adding `class="legacy"` to `<html>` (the browser preview does this in review).

## 7. Camera / AR: decision (revised 2026-10-24)
**No camera view as the core experience.** The reasons, in order:
- **Eyes beat cameras here.** The ISS and Tiangong are among the brightest things in the sky. A live phone-camera preview at night is mostly black.
- **Bright screens ruin night vision** (see night mode above).
- **Web compass headings come from the magnetometer.** A 2013 study measured ~10–30° mean error on phones of the time; modern phones are better but still disturbed by cars and metal. An overlay 15° off looks broken, while "start where the sun went down, two fists up" is always right.
- **Friction:**
  - iOS needs separate permission taps for motion and camera.
  - Camera access is reported broken in iOS in-app browsers (WebKit bug 183201), where our audience opens links. To be verified on a real device.

**Revised at Ishaan's direction, shipped now as Sky View.** The objections became design requirements:
- The **drawn sky is the default**, with the camera as an optional backdrop, so it works in the dark.
- **Magnetic declination** is corrected with NOAA WMM2025.
- **One-tap calibration** against the Moon or a bright planet removes compass drift.
- **Drag-to-look** works wherever sensors or the camera are blocked.
- **Red light** protects night vision.
- A **guidance arrow** with "turn right 40°" text, plus a buzz on Android when you're aligned.
- **Preview the pass:** watch it happen from your spot before it happens.

Learn: `docs/learn/11-compass.md`.

## 7b. Hero picture (postcard)
The top of the page is a picture of what you'll see, facing where the pass begins: the real twilight colour at that minute, the real stars and planets, and the path with minute marks. The horizon sits at ~60% height so the answer reads on the "ground". It replaced a text-first header because the strongest argument for this app is showing *your* sky, not describing it.

## 8. Voice
- Write like a friend standing next to you outside. Short sentences. Specific.
- Directions as words ("west-southwest"); heights as fists; brightness anchored to familiar things.
- Explain surprises before they confuse: "It won't set: it fades out 4.5 fists up as it slips into Earth's shadow. That's normal."
- Never "amazing", "stunning", "unlock". No exclamation marks in the UI.
- Copy lives in `src/copy/en.ts` (zh-Hans joins it in Phase 3), never inside components.
