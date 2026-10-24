# Growth system

**Principle:** every feature either answers the question faster or makes sharing effortless. Our advantage is distribution: Fremont and Bay Area parent group chats with thousands of tech-literate families. Win there first, then search, then everywhere else.

## A. Built-in virality (all static-site friendly)
| # | Mechanism | Phase | Notes |
|---|---|---|---|
| 1 | **Share card** (client-side canvas PNG, EN/zh, mini sky arc, QR code to the exact page) | 3 | The image is the primary share unit: WeChat link previews are unreliable. Must work in WeChat, WhatsApp and iMessage. |
| 2 | **Per-place pages** with OG/Twitter meta and build-time OG images | 5 | Bay Area plus the top ~1,000 cities. |
| 3 | **Calendar:** one-off 14-day `.ics` with alarms (client-side); `webcal://` subscription feeds (static, rebuilt by Action) | 3 / 5 | Retention without a backend. Google refreshes subscriptions only about every 12–24 h (unofficial, not configurable). Alarms in subscribed feeds may be dropped; to be tested on real devices. |
| 4 | **Embed widget** `/embed/<place>` for schools, PTAs, libraries, HOAs and clubs | 6 | Includes a "powered by SkyPassAlert" link. |
| 5 | **"Tell a neighbor"** prompt after viewing a good pass | 6 | At most once a day, easy to dismiss, never nagging. |
| 6 | **"I saw it!"** anonymous aggregate counter | 6 | Only if the approved analytics supports custom events. Social proof plus accuracy signal. |

## B. Search (programmatic SEO, done honestly)
- **Place pages:**
  - "ISS pass times in <City>": the next 7 days computed at build time, local sunrise/sunset, viewing tips, FAQ.
  - Genuinely useful, not thin. Unique titles and descriptions, canonical URLs, hreflang en/zh-Hans, JSON-LD, sitemap.xml.
  - Rebuilt daily.
- **/how-it-works:** method and the accuracy report. **Comparison page:** only after MARKET.md claims are verified, and no disparagement.
- **orbitalradar.com** already runs per-city "ISS visible tonight" pages (see MARKET.md). Our angle: bilingual pages, Tiangong included, family framing, calendar feeds, and a transparent accuracy report.
- The parent submits the sitemap to Google Search Console and Bing Webmaster Tools. Verification uses an HTML file or meta tag (no DNS changes); exact steps come in Phase 5.

## C. Measurement (privacy-first)
- **Proposal (Phase 6, needs approval):** GoatCounter.
  - Cookieless, no personal data, free for "reasonable public usage". Terms checked 2026-10-24.
  - The account holder must be 13+, so the **parent creates the account**. Re-verify custom events and cookie behavior before integrating.
- **Source tags:** `?s=wechat`, `?s=whatsapp`, `?s=nextdoor`, `?s=facebook`, `?s=pta`, `?s=flyer`, `?s=poster`, `?s=embed`, `?s=share` (share-card QR).
- **Metrics:** visitors, returning visitors, shares, calendar adds/subscribes, "saw it" taps, language split, place split.
- **Initial 30-day targets** (adjust once data exists):

  | Metric | Target |
  |---|---|
  | Unique visitors | 500 |
  | Calendar adds/subscribes | 100 |
  | Returning-visitor rate | 40% |
  | Share of traffic from Fremont/Bay Area | ≥70% |

## D. Launch campaign (Phase 7 → `docs/growth/`)
- `LAUNCH.md`: soft launch to about 10 trusted families (end of Phase 3), fix what breaks, then a staged public launch timed to a great evening pass. A launch-window finder (using our engine) ranks the next 30 days of Fremont evening passes by elevation, brightness and kid-friendly hour.
- **Message pack**, EN and zh-Hans, for WeChat, WhatsApp, Nextdoor, Facebook groups, and school/PTA newsletters:
  - Each message has its own `?s=` link and share image.
  - Honest framing: free, student-built, open source, no ads, no data collected.
  - **Never** fabricate testimonials, user counts or endorsements.
  - Respect each group's rules and admins. Ask before posting. Never spam.
- **Flyer and poster:** print-CSS HTML → PDF, with QR code. Also a list of outreach targets, each verified before listing: school science teachers and clubs, libraries, local astronomy societies and science centers, PTAs, neighborhood associations, local news and newsletters.
- **90-day sky calendar:** bright ISS and Tiangong passes from our engine, meteor showers, launches visible from California, eclipses and conjunctions. All verified, each with a ready post in EN and zh.
- `docs/MEDIA.md`: a one-page press/about kit. Student privacy defaults to first name and city only.
- `docs/growth/WEEKLY.md`: what to check, what to post, what to fix, how to read the numbers.

## E. Trust and safety
- `/privacy` in plain language: no accounts, no cookies, geolocation on-device, analytics details, no data from minors.
- `/about`, plus a visible disclaimer that predictions are estimates and not for safety-critical use.
- Contact: hello@skypassalert.com.
