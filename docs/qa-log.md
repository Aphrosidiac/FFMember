# QA log — FF Member

## 2026-10-03

**Decision (logged as the Gate 1 self-review).** The brief asked for an exact copy of moto-card.com.
That was declined (see `docs/brief.md`), and an original FF site was built in the same genre instead.
The reference snapshot in `docs/reference/2026-10-03/` (git-ignored) was used only to learn the genre.
None of its files, code or text are in `src/`, `public/`, `partials/` or the HTML pages.

**Instruments.** Headless Chromium through Playwright (`tools/browser.mjs`). The in-app browser pane
reported `visibilityState: hidden` and a 0×0 viewport, so it was not used as evidence.
- `tools/strip.mjs` walks a page with real wheel input and screenshots the viewport at each
  offset. Pinned sections only exist mid-scroll.
- `tools/check.mjs` is the functional pass.
- `tools/capture.mjs` takes the top-of-page shots.

**Visual pass, 1440 and 390, home strip plus every page top.** Defects found and fixed:
1. The hero card and plinth covered the headline. The camera moved back, the look-at point moved down,
   and the shade deepened.
2. The globe's opening headline overlapped the planet. The planet now rises from lower down on an
   in-out ease, and the headline leaves first.
3. The word rotator went blank between words. The transitions now overlap.
4. The plan badge said "Most chosen fit", a claim nobody can back up. It now reads "Includes monthly
   changes".
5. The process frame cropped the LEWIX AI shot down to "WIX". Every screenshot (process frames and tube
   tiles) now sits inset on a graphite plate, per the FF rule against full-bleed portfolio shots.
6. Phone: the globe chips ran off the screen edges. They are now a wrapped row near the bottom.
7. Phone: the closing globe copy overlapped the planet. The planet now settles higher on portrait
   screens.
8. Phone: the tube camera moved closer.
9. Desktop: the spotlight lit the floor behind the hero paragraph. The cone is narrower and the floor
   darker.

**Real bug found by the checker.** The intro never visibly played. On a slow GPU, compiling the hero
scene stalled the main thread for about 2 s, and with `gsap.ticker.lagSmoothing(0)` the intro timeline
jumped to its end. Default lag smoothing is restored, so timelines pause through stalls.

**Checker bug.** The first run resolved in-page `#anchor` links on the legal pages against `/`, which
gave 11 false failures. Fixed to resolve each anchor against its own page.

**Functional pass, `tools/check.mjs`: 158/158 on dev (:3180) and 158/158 on the production build
(`vite preview` :3181).** Output is saved in `docs/qa/check.txt` and `docs/qa/check-prod.txt`. It covers:
- five pages × seven widths (320–1920): HTTP 200, no console or page errors, no horizontal overflow
- every internal link and anchor
- external links limited to FF-owned domains and FF contact details
- billing toggle values
- plan modal fees, Escape to close, focus return, and the hand-off to the join form
- join form: empty submit, invalid email and site, hostile name rendered as text, success summary,
  the mailto draft's contents, edit, close, focus trap
- FAQ: one panel open at a time, `hidden` kept in sync
- phone menu: open, focus, link closes it and scrolls
- reduced motion: no intro, no Lenis, no text left invisible
- first visit plays the intro and then removes it
- zero third-party requests

**Not checked.** A real-device GPU run (headless used SwiftShader), Lighthouse field numbers, and
WebKit/Safari behaviour.

## 2026-10-03 — restructure (option 2) + real-Chrome pass

Fakhrul asked again for a 1:1 copy. That was declined again, and he chose option 2: follow
moto-card.com's section order and scene types, measured rhythm (16px gutter, 52–64px headings at
1440), with FF's own words, imagery, 3D and code.

New home order:
1. centred hero
2. globe with tick toasts
3. card tube with a centred close
4. figures arcs (light)
5. support with clocks
6. oval reveal
7. numbered "covers" list
8. plans banner
9. plans
10. grouped FAQ (light)
11. footer

Fonts, palette and type voice stay FF's.

The pass ran in Claude in Chrome (tab fronted, `visibilityState: visible`, 1920×907), scrolling with
the real wheel. Fixed:
- the globe's empty tail (pin 350→270svh)
- the dark gap before the tube (tiles fade in at 2% of the section, was 12%)
- figures crossing the heading (solid backing, rows bow outward)
- the oval opening on the grid's gutter cross (now a single plated shot)
- the double gap between plans and FAQ
- the oversized footer mark

`tools/check.mjs` passed 158/158 after the restructure. The phone strip at 390 is clean.

## 2026-10-03 — hero render quality

Fakhrul compared the hero side by side in Chrome and found it flat (backdrop and render quality).
The hero stage was rebuilt with our own techniques:
- a relief-shaded rock wall drawn in GLSL (fractal height field, slope lighting)
- an additive mist band along the horizon
- a `Reflector` mirror floor under a smoked sheet
- a chrome plinth with lit seams, under `RectAreaLight` panels
- a softbox PMREM environment (black room plus five emissive strips) so metal reflects crisp
  gradients
- AgX tone mapping, 2× pixel ratio on desktop (1.5× and a 512 mirror texture on touch devices)
- a `polished` card finish

Bugs fixed along the way:
- The hero entrance never fired when the scene took more than 2.5 s to build. It now plays
  whenever the scene is ready.
- On a very slow GPU the intro could hold the page for 30 s or more. It is now capped at 6 s
  wall-clock.

Real Chrome, first visit: intro cleared at 5.3 s, 61 fps with the new scene.
`tools/check.mjs`: 158/158.

## 2026-10-03 — hero lighting, second pass

Fakhrul's crop showed a flat grey card, a blown-out white chip and no contrast. Causes and fixes:
- **No contrast.** AgX tone mapping compressed everything to mid-grey, so the hero now uses ACES.
- **Flat grey card.** A large, even front fill made the card reflect uniform grey. The environment
  is now a black room with narrow, bright bars separated by dark gaps: two overhead, two vertical,
  a horizon bar behind and a low front bar aimed at the angle the plinth front reflects. Sampling
  is by direction, so the bar's elevation had to be matched.
- **Card finish.** Full metal, anisotropy 0.8 so highlights stretch along the brushed grain,
  clearcoat 0.02.
- **Blown chip.** It was mirror-smooth and reflected the key bar head-on. It is now champagne with
  a satin roughness.
- **Plinth.** Mirror chrome with a `Reflector` top, so the card reflects in it.

Verified with zoomed crops in real Chrome. `tools/check.mjs`: see `docs/qa/check.txt`.

## 2026-10-04 — robustness from the lighting pass

- **Real bug, mine.** Adaptive quality declared `degraded` after `layout()` used it (TDZ), so the
  hero init threw and the scene never built.
- **Checker bug that let it through.** `main.js` catches scene failures as console *warnings*, and
  the checker only counted errors, so 158/158 passed with no hero. The checker now fails on any
  `[hero]`, `[globe]` or `[tube]` warning, and asserts the hero stamps `data-drawn` after its first
  real frame.
- **Adaptive quality.** If the first 40 frames give a median above 36 ms, the hero drops to pixel
  ratio 1 and turns off both mirrors.
- **Text entrance on CSS.** The hero text and nav entrance moved from GSAP to CSS transitions
  (`.hero-pre` → `.hero-entering`). The compositor runs them by the clock, so they finish on time
  even while WebGL starves the main thread.
- **Measurement fixes in the checker.** The intro is sampled at DOMContentLoaded. The menu scroll
  check waits for the smooth scroll to settle.

`tools/check.mjs`: 159/159. Real Chrome: `drawn=1`, quality full, intro cleared, nav and headline
at opacity 1.

## 2026-10-04 — globe rebuilt to the reference's motion

Fakhrul compared the globe with moto-card.com side by side and asked for the same animation.
Measured with `tools/globe_strip.mjs` (both sites, same scroll offsets, 1440×900 and 390×844), then
rebuilt `src/js/gl/globe.js`:
- **Shading.** Physically lit sphere on `WebGPURenderer` (WebGL2 backend) after the MIT three.js TSL
  earth example: day map, night lights by sun angle, cloud whitening, bump from relief and clouds,
  glossier oceans, an atmosphere crest masked to the upper half, a back-face glow shell at 1.04.
  ACES at exposure 1.16, sun at (0.26, 1.39, −3) intensity 6.
- **Framing.** Camera fov 25 at (0, 0.2, 5); planet at y −1.32, scale 1.3; idle spin 0.025 rad/s on
  the clock from load.
- **Scroll.** The section is one viewport tall and pinned for 2.5 viewports with no spacing, so the
  tube scrolls up underneath (the tube's −75svh overlap is gone). One scrubbed timeline (scrub 1):
  turn −π/1.4 → −π/5 over the first half, shrink to 40% (power2.out) from 0.1, fade out 0.2 → 0.35,
  header lifts −120%, chips drop out in random order and are removed at 0.45.
- **Chips.** Three, at the reference's positions and breakpoints; 5px blur on a dark teal glass.
- **Textures.** `tools/grade_globe.py` regrades NASA sources: July 2004 Blue Marble with blue oceans
  (December snow read as cloud), Black Marble 2016 lights over a flat dark base (the 2012 map was
  blue-tinted and blurry). Bases moved to `docs/sources/globe-base/`.

The globe chunk grows to 590 kB (168 kB gzip) because it brings in the node renderer; it is
lazy-loaded with the section. `tools/check.mjs`: 159/159.
