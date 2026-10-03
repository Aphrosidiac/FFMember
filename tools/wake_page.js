/*
 * wake_page.js — make a scroll-animated page show its content before you measure it.
 *
 * THE PROBLEM
 * Entrance and scroll-driven reveals are driven by requestAnimationFrame and
 * IntersectionObserver. In a hidden pane, a background tab, or a throttled automation
 * window, neither fires. The page renders fully, sits at opacity: 0, and photographs as an
 * empty dark rectangle — so the agent reports "the site is just a dark blank theme". That
 * is the instrument talking, not the site.
 *
 * Measured in the in-app Browser pane while hidden (lewix.ai, 2026-09-03):
 *   visibilityState "hidden", rafFires false, viewport 0x0,
 *   and setTimeout(50) actually took 788-879ms across runs — a 16-18x clamp.
 * A naive step-scroll with dwell blows the tool's own 45s timeout before it does anything.
 * So this script measures the environment first and picks a strategy from what it finds.
 *
 * USE
 *   1. Front the tab / show the pane first if you can — that is the real fix, and the only
 *      way to judge motion. This script cannot un-hide itself. For claude-in-chrome use
 *      scripts/front_tab.sh <url-substring>; for evidence, prefer headless capture.mjs.
 *   2. Run this. Read `verdict` before anything else.
 *   3. Screenshot / run extract_tokens.js.
 *
 * CFG.reveal = false probes without mutating anything — use it to ask "does this page
 * animate at all", and to check our own build's resting state.
 */
await (async () => {
  const CFG = {
    reveal: true,       // false = probe only, mutate nothing
    budgetMs: 20000,    // total wall-clock allowance; stays under a 45s tool timeout
    maxSteps: 20,       // scroll stops when the tab is actually rendering
    finish: true,       // finish outstanding Web Animations
    unhide: true,       // force the resting state on anything still invisible
    nudgeLibs: true,    // poke GSAP ScrollTrigger / AOS / Locomotive if present
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sel = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return (el.tagName.toLowerCase() + id + cls).slice(0, 70);
  };

  // Leaf-ish elements carrying real text. checkVisibility({opacityProperty:true}) is the
  // load-bearing bit: opacity is NOT inherited in computed style, so a child of an
  // opacity:0 parent reports opacity 1. Testing the element alone misses the whole page.
  // script/style/template carry text but are never painted; counting them buries the signal.
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'META', 'LINK', 'HEAD']);
  const textLeaves = () => [...document.querySelectorAll('body *')].filter((el) => {
    if (SKIP.has(el.tagName) || el.children.length) return false;
    const t = el.textContent && el.textContent.trim();
    return t && t.length >= 3;
  });
  const isPainted = (el) => {
    if (el.checkVisibility) {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
    }
    let n = el;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
      n = n.parentElement;
    }
    return true;
  };
  const census = () => {
    const leaves = textLeaves();
    const hidden = leaves.filter((el) => !isPainted(el));
    return {
      textElements: leaves.length,
      invisible: hidden.length,
      samples: hidden.slice(0, 6).map((el) => ({ el: sel(el), text: el.textContent.trim().slice(0, 60) })),
      _hidden: hidden,
    };
  };

  // --- Probe the instrument, including how hard timers are clamped ----------
  const t0 = performance.now();
  let rafFired = false;
  requestAnimationFrame(() => { rafFired = true; });
  for (let i = 0; i < 4; i++) await sleep(50);
  const perSleep = (performance.now() - t0) / 4;

  const before = census();
  const probe = {
    visibilityState: document.visibilityState,
    documentHidden: document.hidden,
    hasFocus: document.hasFocus(),
    rafFires: rafFired,
    timerClamp: `asked 50ms, got ${Math.round(perSleep)}ms (${(perSleep / 50).toFixed(1)}x)`,
    rendering: rafFired && (innerWidth > 0),
    runningAnimations: document.getAnimations ? document.getAnimations().length : null,
    viewport: { w: innerWidth || document.documentElement.clientWidth, h: innerHeight || document.documentElement.clientHeight },
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    libs: ['gsap', 'ScrollTrigger', 'AOS', 'Lenis', 'LocomotiveScroll', 'ScrollMagic', 'Motion']
      .filter((k) => window[k]),
    textElements: before.textElements,
    invisibleText: before.invisible,
    invisibleShare: before.textElements ? +(before.invisible / before.textElements).toFixed(2) : 0,
  };

  const diagnosis = !probe.rendering
    ? 'NOT RENDERING — this tab/pane is not painting. rAF never fires, so no reveal, no lazy image, no smooth scroll will ever happen here, however long you wait. Any screenshot is void. Front the tab (scripts/front_tab.sh for claude-in-chrome — tabs_select does not front it) or capture headless with scripts/capture.mjs.'
    : (probe.invisibleShare > 0.3
        ? 'RENDERING, but most text is invisible — the reveal has not been triggered yet (or the resting state is broken). Scroll it.'
        : 'Rendering and painting normally. Screenshots are trustworthy.');

  if (!CFG.reveal) {
    return { mode: 'probe', verdict: diagnosis, probe,
      before: { textElements: before.textElements, invisible: before.invisible, samples: before.samples } };
  }

  // --- Reveal, with a strategy chosen from the probe ------------------------
  const actions = [];
  const patch = document.createElement('style');
  patch.id = '__wake_page_patch';
  // html{scroll-behavior:smooth} turns scrollTo into an animation — the exact thing that
  // does not run in a throttled tab. Force instant jumps.
  patch.textContent = 'html,body{scroll-behavior:auto!important}';
  document.head.appendChild(patch);

  const startScroll = scrollY;
  const H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - (innerHeight || 800);

  if (!probe.rendering) {
    // Dwelling is pure waste here: observers cannot fire without a render loop, and every
    // sleep costs ~16x what you asked for. Skip straight to forcing the resting state.
    actions.push('skipped step-scroll — tab is not rendering, so no dwell could ever help');
  } else if (H > 0) {
    const spent = performance.now() - t0;
    const dwell = Math.max(60, Math.round(perSleep));
    const steps = Math.max(3, Math.min(CFG.maxSteps, Math.floor((CFG.budgetMs - spent) / (dwell + 30))));
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, Math.round((H * i) / steps));
      dispatchEvent(new Event('scroll'));
      await sleep(dwell);
      if (performance.now() - t0 > CFG.budgetMs) { actions.push('scroll pass cut short by time budget'); break; }
    }
    window.scrollTo(0, 0);
    await sleep(dwell);
    actions.push(`step-scrolled ${steps} stops over ${Math.round(H + (innerHeight || 0))}px at ${dwell}ms dwell`);
  } else {
    actions.push('page is not scrollable — no step-scroll');
  }

  if (CFG.nudgeLibs) {
    try { if (window.ScrollTrigger?.refresh) { ScrollTrigger.refresh(); actions.push('ScrollTrigger.refresh()'); } } catch (e) {}
    try { if (window.AOS?.refreshHard) { AOS.refreshHard(); actions.push('AOS.refreshHard()'); } } catch (e) {}
    try { if (window.locoScroll?.update) { locoScroll.update(); actions.push('locomotive update()'); } } catch (e) {}
  }

  if (CFG.finish && document.getAnimations) {
    let n = 0;
    for (const a of document.getAnimations()) {
      // Leave infinite loops (marquees, pulses) alone — finishing them throws.
      try { if (a.effect?.getTiming?.().iterations !== Infinity) { a.finish(); n++; } } catch (e) {}
    }
    if (n) actions.push(`finished ${n} animation(s)`);
  }

  let forced = 0;
  if (CFG.unhide) {
    // Walk up from each still-invisible text leaf to the ancestors actually suppressing it
    // and pin those to their resting state. Targeted on purpose: a global
    // *{opacity:1!important} would also reveal every closed modal, drawer and dropdown,
    // and produce a screenshot that is wrong in a new way.
    const touched = new Set();
    for (const el of census()._hidden) {
      let n = el;
      while (n && n.nodeType === 1 && n !== document.body) {
        const s = getComputedStyle(n);
        const flat = parseFloat(s.opacity) < 0.99;
        const moved = s.transform && s.transform !== 'none';
        const clipped = s.clipPath && s.clipPath !== 'none';
        if ((flat || moved || clipped) && !touched.has(n)) {
          touched.add(n);
          if (flat) n.style.setProperty('opacity', '1', 'important');
          if (moved) n.style.setProperty('transform', 'none', 'important');
          if (clipped) n.style.setProperty('clip-path', 'none', 'important');
          n.style.setProperty('visibility', 'visible', 'important');
          forced++;
        }
        n = n.parentElement;
      }
    }
    if (forced) actions.push(`forced resting state on ${forced} ancestor(s)`);
  }

  const after = census();
  window.scrollTo(0, startScroll);
  const revealed = before.invisible - after.invisible;

  return {
    mode: 'reveal',
    verdict: !probe.rendering
      ? `TAB IS NOT RENDERING. Content forced visible (${before.invisible} → ${after.invisible} hidden of ${before.textElements}). Text, structure and layout are now readable and the page was NEVER a blank theme — but MOTION, LAZY IMAGES AND ANYTHING TIME-BASED CANNOT BE JUDGED HERE. Front the tab or use a real window for those.`
      : (revealed > 0
          ? `Revealed ${revealed} hidden text element(s) — the page was mid-animation, not blank. Safe to screenshot now.`
          : 'Nothing was hidden; the page was already painting. Screenshots were already trustworthy.'),
    probe,
    diagnosis,
    actions,
    elapsedMs: Math.round(performance.now() - t0),
    before: { textElements: before.textElements, invisible: before.invisible, samples: before.samples },
    after: { textElements: after.textElements, invisible: after.invisible, samples: after.samples },
    warning: forced
      ? 'Inline styles were injected to force the resting state. Read content, structure and layout from this — do NOT measure motion, and reload before judging the real entrance sequence.'
      : null,
  };
})()
