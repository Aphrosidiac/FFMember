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
