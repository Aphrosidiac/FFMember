# Parity ledger

**17/20 complete** — 17 done, 1 partial, 1 deferred, 1 omitted

## global

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| P-01 | Intro: FF mark, KL clock, progress, curtain; once per session | done | check.mjs intro test 2026-10-03; lag-smoothing bug fixed |  |
| P-02 | Nav: hide on scroll down, backing past hero, current section, desktop + phone menu | done | strip 1440/390 + check.mjs menu tests 2026-10-03 |  |
| P-13 | Footer: CTA, columns, live clock, legal | done | strip frames + link checks 2026-10-03 |  |
| P-16 | 404 page | done | capture 1440/390 2026-10-03 |  |
| P-17 | Reduced motion | done | check.mjs reduced-motion tests 2026-10-03 |  |
| P-18 | SEO: titles, descriptions, OG, JSON-LD Service offers | done | present in HTML 2026-10-03; og.jpg + canonical 2026-10-04 | canonical and og:url point at ff-member.pages.dev (the live address); og.jpg 1200×630 cut from the hero |
| P-19 | Real-device GPU, Safari, Lighthouse | deferred |  | Headless SwiftShader only |

## home

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| P-03 | Hero WebGL: FF card over plinth, pointer lean, scroll tip | done | shots-prod/index-top-1440 + strip frames 2026-10-03 | Motion judged in headless frames only; not yet eyeballed on a real GPU |
| P-04 | Pinned globe: NASA textures, own GLSL day/night/clouds/glint/limb, KL pin, chips, copy hand-over | done | strip 1440/390 2026-10-03 |  |
| P-05 | Tube of plated FF work tiles + card revolution + word rotator | done | strip 1440/390 2026-10-03 |  |
| P-06 | Scroll-scrubbed numerals (verified FF facts only) | done | strip 1440/390 2026-10-03 |  |
| P-07 | Plans with monthly/yearly toggle | done | check.mjs price tests 2026-10-03 | Prices from SERVICE_ARCHITECTURE.md |
| P-08 | Plan detail modal | done | check.mjs fee + focus tests 2026-10-03 |  |
| P-09 | Join modal: validation, summary, mailto draft, no network | done | check.mjs join tests + zero third-party requests 2026-10-03 | No backend by design |
| P-10 | Work marquee with velocity push + KL clock | done | strip frames 2026-10-03 |  |
| P-11 | Process: sticky plated frame follows active step | done | strip 1440/390 2026-10-03 |  |
| P-12 | FAQ accordion, one open, a11y | done | check.mjs faq test 2026-10-03 |  |

## legal

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| P-15 | Terms + privacy, true for this build | done | capture + anchor checks 2026-10-03 | Not reviewed by a lawyer |

## reference

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| P-20 | Exact 1:1 copy of moto-card.com | omitted |  | Declined: would reproduce a third party's copyrighted site. See docs/brief.md |

## studio

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| P-14 | Studio page: hero, FF work grid, principles | done | capture top 1440/390 + overflow checks 2026-10-03 |  |

