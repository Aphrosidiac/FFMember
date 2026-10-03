/*
 * extract_tokens.js — design-token extractor for reference-clone.
 *
 * Paste the whole file into the browser tool's JS execution on the page you are
 * measuring (Chrome MCP javascript_tool, or the Browser pane's javascript_tool).
 * It is an IIFE whose value is the result object, so REPL semantics return it.
 *
 * Run it on at least three structurally different pages, plus once at mobile
 * width, and save each result to docs/reference/tokens/<page>.json.
 *
 * Headless alternative that avoids hidden-tab lies entirely: scripts/tokens.mjs runs this
 * file across pages and widths and writes the JSON for you.
 *
 * Reads only what the page already rendered. It sends nothing anywhere.
 */
(() => {
  const tally = () => new Map();
  const bump = (m, k, el) => {
    if (k == null || k === '' || k === 'none' || k === 'normal' || k === 'auto') return;
    const e = m.get(k) || { count: 0, sample: null };
    e.count++;
    if (!e.sample && el) e.sample = sel(el);
    m.set(k, e);
  };
  const sel = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return (el.tagName.toLowerCase() + id + cls).slice(0, 80);
  };
  const top = (m, n = 40) => [...m.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n)
    .map(([value, e]) => ({ value, count: e.count, sample: e.sample }));
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const visible = (el, r) => r.width > 0 && r.height > 0;
  // Split a CSS list on top-level commas only: cubic-bezier(0.4, 0, 0.2, 1) is ONE value.
  const first = (v) => {
    let depth = 0;
    for (let i = 0; i < v.length; i++) {
      const c = v[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) return v.slice(0, i).trim();
    }
    return v.trim();
  };
  // A pill is authored as 9999px and computes to a huge number; say so.
  const radius = (v) => (parseFloat(v) >= 500 ? 'pill (>=9999px)' : v);
  // The browser pane can report innerWidth 0. Fall back, and flag it.
  const VW = innerWidth || document.documentElement.clientWidth || 0;
  const VH = innerHeight || document.documentElement.clientHeight || 0;

  const type = tally(), families = tally(), weights = tally(), lh = tally(), ls = tally();
  const fg = tally(), bg = tally(), bd = tally();
  const space = tally(), gaps = tally(), radii = tally(), shadows = tally(), borders = tally();
  const dur = tally(), ease = tally(), anim = tally();
  const zidx = tally(), widths = tally(), cols = tally();
  const textNodeSizes = tally();

  const els = [...document.querySelectorAll('body *')].filter((el) => {
    const t = el.tagName;
    return t !== 'SCRIPT' && t !== 'STYLE' && t !== 'NOSCRIPT' && t !== 'BR';
  });

  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const s = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);

    if (hasText) {
      bump(type, `${px(s.fontSize)}px / ${s.fontWeight} / ${px(s.lineHeight) || s.lineHeight} / ${px(s.letterSpacing) ?? '0'}px`, el);
      bump(textNodeSizes, `${px(s.fontSize)}px`, el);
      bump(fg, s.color, el);
    }
    bump(families, s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), el);
    bump(weights, s.fontWeight, el);
    bump(lh, `${px(s.lineHeight) || s.lineHeight}`, el);
    bump(ls, `${px(s.letterSpacing) ?? 0}px`, el);

    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bump(bg, s.backgroundColor, el);
    if (s.borderTopWidth !== '0px') { bump(bd, s.borderTopColor, el); bump(borders, `${px(s.borderTopWidth)}px ${s.borderTopStyle}`, el); }

    for (const p of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
      const v = px(s[p]); if (v) bump(space, `${v}px`, el);
    }
    if (s.display === 'flex' || s.display === 'grid' || s.display === 'inline-flex') {
      const g = px(s.rowGap) ?? px(s.gap); if (g) bump(gaps, `${g}px`, el);
      if (s.gridTemplateColumns && s.gridTemplateColumns !== 'none') {
        // Computed value resolves fr/auto to px, so record the column count, which survives.
        bump(cols, `${s.gridTemplateColumns.trim().split(/\s+/).length} cols — ${s.gridTemplateColumns.slice(0, 60)}`, el);
      }
    }
    if (s.borderRadius !== '0px') bump(radii, radius(s.borderRadius), el);
    if (s.boxShadow !== 'none') bump(shadows, s.boxShadow.slice(0, 120), el);
    if (s.transitionDuration !== '0s') { bump(dur, first(s.transitionDuration), el); bump(ease, first(s.transitionTimingFunction), el); }
    if (s.animationName !== 'none') bump(anim, `${s.animationName} ${s.animationDuration} ${s.animationTimingFunction}`, el);
    if (s.zIndex !== 'auto') bump(zidx, s.zIndex, el);
    if (s.maxWidth !== 'none' && px(s.maxWidth) > 400) bump(widths, s.maxWidth, el);
  }

  // Breakpoints from same-origin stylesheets. Cross-origin sheets throw on cssRules.
  const bps = new Set(); let blockedSheets = 0;
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.media) { for (const m of rule.media) (m.match(/\d+(\.\d+)?(px|em|rem)/g) || []).forEach((v) => bps.add(v)); }
      if (rule.cssRules) { try { walk(rule.cssRules); } catch (e) { /* nested import */ } }
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch (e) { blockedSheets++; }
  }

  let bodyEl = null, bw = 0;
  for (const el of document.querySelectorAll('article p, main p, p')) {
    const r = el.getBoundingClientRect();
    if (r.width > bw && el.textContent.trim().length > 80) { bw = r.width; bodyEl = el; }
  }
  let measureCh = null;
  if (bodyEl && bw > 0) {
    const s = getComputedStyle(bodyEl);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const chW = c.measureText('0').width;
    if (chW) measureCh = Math.round(bw / chW);
  }

  // Only faces that actually loaded — document.fonts also lists declared-but-unused faces.
  const fonts = [...(document.fonts || [])].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`);

  return {
    meta: {
      url: location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      viewport: { w: VW, h: VH, dpr: devicePixelRatio },
      visibilityState: document.visibilityState,
      viewportSuspect: innerWidth === 0
        ? 'innerWidth reported 0 — the automation pane is not laying out normally. Width-dependent numbers here are unreliable; re-measure headless (scripts/tokens.mjs) or in a fronted window.'
        : (document.visibilityState === 'hidden'
          ? 'tab is hidden — rAF is suspended, so entrance/scroll reveals may not have run and the viewport may be stale. Static tokens are fine; motion, widths and anything revealed on scroll are not. Front the tab (scripts/front_tab.sh) or use scripts/tokens.mjs.'
          : null),
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      elementsMeasured: els.length,
      blockedStylesheets: blockedSheets,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    },
    typography: {
      combos: top(type, 30),
      families: top(families, 10),
      sizes: top(textNodeSizes, 20),
      weights: top(weights, 10),
      lineHeights: top(lh, 12),
      letterSpacing: top(ls, 10),
      loadedFaces: [...new Set(fonts)].slice(0, 30),
      bodyMeasureChars: measureCh,
    },
    color: { text: top(fg, 20), background: top(bg, 20), border: top(bd, 15) },
    spacing: { margins_padding: top(space, 30), gaps: top(gaps, 20) },
    shape: { radii: top(radii, 15), borders: top(borders, 10), shadows: top(shadows, 12) },
    motion: { durations: top(dur, 12), easings: top(ease, 12), keyframeAnimations: top(anim, 12) },
    layout: {
      breakpoints: [...bps].sort((a, b) => parseFloat(a) - parseFloat(b)),
      containerMaxWidths: top(widths, 12),
      gridTemplates: top(cols, 12),
      zIndexLayers: top(zidx, 15),
      hasHorizontalOverflow: VW > 0 && document.documentElement.scrollWidth > VW + 1,
      widestNode: (() => {
        if (!VW) return null;
        let worst = null, w = VW + 1;
        for (const el of els) { const r = el.getBoundingClientRect(); if (r.right > w) { w = r.right; worst = sel(el) + ` right=${Math.round(r.right)}`; } }
        return worst;
      })(),
    },
  };
})()
