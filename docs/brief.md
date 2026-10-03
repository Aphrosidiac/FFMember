# Build brief — FF Member

## What was asked, and what is being built

Fakhrul asked (2026-10-03) for an exact 1:1 copy of https://www.moto-card.com/ — a Webflow site for a
Visa Infinite card, designed by a third-party studio — with every asset downloaded.

**An exact copy is not being built.** A pixel-matched rebuild that keeps the reference's page, text,
photography, hero film, card renders and WebGL code, with only the name swapped, reproduces someone
else's copyrighted work. Re-typing their code and sentences while keeping the page pixel-identical
does not change that.

**What is built instead** is an original FF Dev Studio site in the same genre and at the same level of
craft: a dark, luxury, motion-led one-pager with a preloader, a pinned WebGL globe, a 3D card inside a
spinning tube of image tiles, scroll-scrubbed numerals, a pinned plans section, marquees, an accordion
FAQ and modal flows. Every line of code, every word and every image is FF's own or public domain.

## Identity

- **Product name:** FF Member — FF Dev Studio's managed-care plans (Care / Maintain / Evolve) presented
  as a membership with a members' card.
- **Owner / brand:** FF Dev Studio (FF DEV STUDIO, 202603234793), Kuala Lumpur.
- **Brand kit:** `~/Desktop/dev/ffdevstudio/brand-system` — FF mark and lockup SVGs, Instrument Sans /
  Instrument Serif (SIL OFL), palette Ink #0B0B0A, Bone #F3EFE4, Graphite #242421, Field Grey #8B8981,
  Signal Lime #D9FF43 (sparse signal only).
- **Facts used in copy:** `~/Desktop/dev/ffdevstudio/SERVICE_ARCHITECTURE.md` (plan prices, inclusions,
  exclusions, client process, 30-day defect warranty) and `PhantomClone/src/data.js` (project list).
  No invented statistics, testimonials or clients.
- **Imagery:** screenshots of FF's own client and product work (Hai Awan, Sunlight Supplies, LEWIX AI,
  SmoothSail, Big Brain Furniture ×2, Ascend Peptides, Lewix) from PhantomClone's media. Recreation
  studies are excluded because their screenshots can contain third-party assets. Globe textures are
  NASA Visible Earth imagery (public domain). No AI-generated imagery (FF rule).

## Reference use

- Reference snapshot, hydrated DOM, screenshots and downloaded assets: `docs/reference/2026-10-03/`,
  git-ignored, **research only**. Nothing in `src/` or `public/` comes from it.
- What was taken from the reference: the *genre* and the *kinds* of motion (preloader into hero, a globe
  that shrinks under a pinned scroll, a card in a tile tube, scrubbed numerals, a pinned plans block).
  Layout, composition, type, palette, copy and code are FF's.

## Mode

- **Fidelity:** translate (own identity, own composition) — `exact` was declined, see above.
- **Mode:** SITE.
- **Stack:** Vite multi-page static, GSAP 3.15 (ScrollTrigger, SplitText), Lenis 1.3.18, three 0.181.1.
  WebGL via `WebGLRenderer` + hand-written GLSL.
- **Questions allowed:** no ("no questions") — gates are self-reviews logged in `docs/qa-log.md`.

## Scope line

- **In scope:** `/` (membership one-pager), `/studio` (about the studio and its work), `/legal/terms`,
  `/legal/privacy`, `404`. Preloader, nav (desktop + mobile), all WebGL scenes, all scroll choreography,
  FAQ, membership modal, plan-detail modal, footer, reduced-motion handling, SEO tags.
- **Not building:** any backend. The membership form validates and then hands off to an email
  draft (mailto) — nothing is sent over the network, nothing is stored. No analytics, no cookies.
- **Parity target:** standalone original site; verified on its own terms (function, motion, responsive,
  a11y, performance), not by pixel diff against the reference.

## Technical

- **Repo:** `~/Desktop/dev/FFMember`, local git, not pushed.
- **Dev:** `npm run dev` → http://localhost:3180 (launch.json name `ff-member`).
- **Hosting:** none. Ask before any push or deploy.
