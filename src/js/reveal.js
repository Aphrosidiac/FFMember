// Scroll reveals. Elements are visible by default in CSS; these tweens only move FROM a hidden
// state, so a script failure or a throttled tab never leaves the page blank.
import { gsap, ScrollTrigger, SplitText, reduced } from './motion.js';

export async function splitLines(el) {
  await document.fonts.ready;
  const split = new SplitText(el, { type: 'lines', linesClass: 'split-line', mask: 'lines' });
  return split;
}

export async function initReveals(root = document) {
  if (reduced) return;
  await document.fonts.ready;
  // Headings: lines rise out of their masks.
  for (const h of root.querySelectorAll('.h1, .h2:not([data-no-split])')) {
    if (h.closest('[data-globe-head], [data-tube-copy], [data-reveal]')) continue;
    const split = new SplitText(h, { type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 110, duration: 1.2, ease: 'power4.out', stagger: 0.09,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true },
      }) });
    h.dataset.split = '1';
    void split;
  }
  // Eyebrows, leads, buttons and list items fade up.
  const fades = root.querySelectorAll('[data-fade], .plans__head .eyebrow, .plans__toggle, .faq__top .lead, .plans__fine, .footer__cta-side, .banner__inner > :not(h2), .support__list, .support__clocks, .covers__count');
  for (const el of fades) {
    gsap.from(el, { opacity: 0, y: 24, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  }
  // Plan cards and FAQ rows stagger in as a group.
  for (const group of root.querySelectorAll('.plans__grid, .faq__groups, .footer__cols')) {
    gsap.from(group.children, { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true } });
  }
  ScrollTrigger.refresh();
}
