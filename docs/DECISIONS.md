# Decisions

Each entry records the options considered, the choice made, and the tradeoffs. Newest entries go at the bottom.

---

## D-001 Static site on GitHub Pages, no backend (2026-10-24)
- **Options:** GitHub Pages; Cloudflare Pages/Netlify; a small server.
- **Choice:** GitHub Pages, deployed by a custom Actions workflow.
- **Why:**
  - Free, and it lives in the same place as the code and the data Actions.
  - The domain is already verified there.
  - A custom workflow has no build-frequency cap.
- **Tradeoffs:**
  - Published site under 1 GB, soft bandwidth limit of 100 GB/month, no server-side logic, no custom response headers (CSP must be a `<meta>` tag).
  - If traffic outgrows Pages, a CDN can sit in front without code changes.

## D-002 Vite + React + TypeScript strict + Tailwind v4 (2026-10-24)
- **Options:** Astro (zero-JS by default); SvelteKit; Vite + React.
- **Choice:** Vite + React.
- **Why:** the brief specifies this stack, and Ishaan already knows it, so he can review every PR. The 150 KB budget is reachable with React plus code-splitting.
- **Tradeoffs:**
  - React costs about 60 KB gzip on the initial route.
  - Pre-rendering place pages needs our own small build-time renderer (`react-dom/server`) instead of a framework's.
- **Settings:** Tailwind v4 uses CSS-first `@theme` tokens, so there's no JS config file. TS adds `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on top of `strict`, because array indexing bugs are the classic numerical-code failure.

## D-003 System fonts on the site; Noto Sans SC only for share cards (2026-10-24)
- **Options:** a web font (Inter, Noto); system stack.
- **Choice:** system stack, with CJK fallbacks (PingFang SC, Noto Sans CJK SC, Microsoft YaHei).
- **Why:**
  - Zero font bytes on the critical path.
  - A full Chinese web font is several MB.
  - Every phone already has a good CJK face.
- **Tradeoffs:**
  - Type looks slightly different by platform.
  - Canvas share cards need a predictable font, so they lazy-load a subset of Noto Sans SC (OFL).

## D-004 OMM JSON, not TLE (2026-10-24)
- **Context:** CelesTrak is phasing out TLE formats. Catalog numbers passed 99999 on 2026-07-11, and newer objects can't be expressed in TLE. Since 2026-05-09 the default `gp.php` format is CSV.
- **Choice:** always request `FORMAT=JSON` (OMM). Both propagators (satellite.js `json2satrec` and ours) consume OMM fields.
- **Tradeoff:** it's slightly larger than TLE, which is irrelevant for two to a few hundred objects.

## D-005 Budgets enforced in CI, not by convention (2026-10-24)
- **Choice:**
  - `scripts/check-bundle-size.mjs` fails CI if the initial-route JS (entry plus modulepreloads) goes over 150 KB gzip.
  - Lighthouse CI (`lighthouserc.json`, mobile emulation, 3 runs) fails if any category drops below 0.9.
- **Why:** budgets that aren't checked drift. Lighthouse reports are kept as CI artifacts and never uploaded to public storage.

## D-006 Pinned dependencies and SHA-pinned Actions (2026-10-24)
- **Choice:**
  - npm packages use exact versions (`--save-exact`) plus the lockfile.
  - Actions are pinned by commit SHA, with the tag in a comment.
  - Dependabot opens grouped monthly PRs.
- **Why:**
  - Reproducible builds.
  - Supply-chain hygiene on a public repo whose workflows can write to Pages.

## D-007 Hero animation uses SVG SMIL, not CSS `offset-path` (2026-10-24)
- **Why:**
  - `<animateMotion>` follows the path in viewBox units, so it scales with the SVG.
  - CSS `offset-path` uses CSS pixels, so it breaks when the SVG resizes.
  - `prefers-reduced-motion` is read with `useSyncExternalStore`; reduced-motion users get a still dot.

## D-008 Accessibility checked with axe-core in tests, not eslint-plugin-jsx-a11y (2026-10-24)
- **Context:** `eslint-plugin-jsx-a11y@6.10.2` (latest) only supports ESLint up to 9, and ESLint 9 is now marked unsupported.
- **Choice:** ESLint 10 for linting. Accessibility is checked by running **axe-core against the rendered DOM** in Vitest (`src/App.test.tsx`), plus the Lighthouse accessibility score of at least 0.9 in CI.
- **Tradeoffs:**
  - axe checks what actually renders (stronger than a static lint), but only for the states the tests render.
  - jsdom can't compute color contrast, so contrast is covered by Lighthouse.
  - Revisit when jsx-a11y supports ESLint 10.
