# Product

## One line
**SkyPassAlert: Look up tonight.** In plain words, it tells you when the International Space Station and China's Tiangong station are visible from where you stand: when to step outside, which way to face, how high it climbs, how bright it is, how long it lasts, and what it will look like.

## Who it's for
- **Launch audience:** families in Fremont, CA and the wider Bay Area. They share things in tight-knit parent group chats: WeChat, WhatsApp, Nextdoor, and school PTA lists.
- **Then:** anyone on Earth. Fremont is the beachhead. It's a default preset, never a special case in code.
- **Personas:**
  - *The parent* wants a 2-minute outdoor moment with the kids before bedtime.
  - *The curious adult* has heard "you can see the space station" and doesn't know where to look.
  - *The teacher or club lead* wants something to share with a class.

## The 3-second rule
Opening the site shows tonight's best pass for the saved or default place at the top of the screen, with zero taps:

> Tonight in Fremont: ISS at 7:42 PM. Look NW, climbs to 62°, bright, 4 min.

Everything else is secondary. "Best" means visible (dark sky, station sunlit, above the minimum elevation), then ranked by peak elevation, brightness and a kid-friendly hour. If tonight has no pass, say so plainly and show the next one.

## What it looks like in the sky (copy we reuse)
A steady, bright light that doesn't blink, moving smoothly and much faster than a star, crossing the sky in a few minutes. Planes blink and often show colored lights. Passes often end with the station fading out before the horizon as it enters Earth's shadow.

## Features (by phase; see ROADMAP.md)
- Tonight's best pass, plus a list for the next days, with data age and an honest uncertainty note.
- Places:
  - Bay Area presets.
  - Geolocation that stays on the device.
  - In-browser city search over GeoNames, with no external geocoding calls.
- **Family mode:**
  - A bedtime filter (default 9:30 PM; only passes ending before it).
  - A kid-friendly wording toggle.
- **Share card:** a one-tap PNG (EN or zh) with a mini sky-arc graphic and a QR code to the exact page. The image is the primary share unit because WeChat link previews are unreliable.
- **Calendar:**
  - A one-off `.ics` of the next 14 days with reminder alarms.
  - Subscribable `webcal://` feeds for presets and top cities.
- **Place pages** for SEO, an **embed widget**, **PWA/offline**, a **compass** "which way to look" view, "tell a neighbor", and an "I saw it!" counter (aggregate only).
- **Languages:** English and Simplified Chinese at launch. The architecture is ready for Spanish, Hindi and more.

## Principles
1. Answer the question faster, or make sharing effortless. A feature that does neither waits.
2. Free forever. No ads, no accounts, no cookies, no personal data.
3. Honest:
   - Predictions are estimates, not for safety-critical use.
   - The accuracy report shows real error numbers.
   - No fabricated users, quotes or stats.
   - No "first" or "only" claims.
4. Works on a mid-range phone over cellular, and offline once loaded.

## Brand
- **Name:** SkyPassAlert. **Tagline:** "Look up tonight." (zh draft: 抬头看，今晚的星空。 Needs native review.)
- **Palette (CSS tokens in `src/index.css`):**

  | Token | Hex | Use |
  |---|---|---|
  | night | `#0B1026` | background |
  | night-raised | `#141B3A` | cards |
  | night-line | `#2A3566` | borders, horizon |
  | ink | `#E8ECF8` | primary text |
  | muted | `#9AA4C2` | secondary text |
  | **accent** | `#FFC65C` | the *one* accent: sunlit amber, the color of a station catching sunlight |

- **Type:**
  - System font stack (zero font bytes). Large sizes: hero 48–72 px, body 18–20 px.
  - Noto Sans SC (OFL), subset, only for canvas share cards.
- **Logo:** a dark disc, a horizon line, a dotted pass arc, and the station as an amber point with a glow (`src/brand/Logo.tsx`, `public/favicon.svg`). Original work.
- **Voice:**
  - Calm, warm, a little playful. Short sentences.
  - Say "Look NW," not "azimuth 315°" (show the degrees as secondary detail).
  - Kid mode: "It's like a star that's in a hurry."
- **Imagery:** original SVG drawn in code, or NASA public-domain media with its source recorded in ASSETS.md and no implied endorsement. No agency or company logos or insignia.

## Trust and safety
- `/privacy` in plain language, `/about`, and a visible disclaimer.
- Contact: hello@skypassalert.com (a Porkbun forward; the parent sets the rule).
- Student privacy by default: first name and city only. No school name, address or photo unless the parent decides otherwise.
