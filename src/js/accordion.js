// FAQ accordion: one open at a time, height animated with GSAP, native `hidden` kept in sync so
// closed answers stay out of the tab order and the accessibility tree.
import { gsap, reduced, ScrollTrigger } from './motion.js';

export function initAccordion() {
  const root = document.querySelector('[data-accordion]');
  if (!root) return;
  const items = [...root.querySelectorAll('.faq__item')];
  const set = (item, open) => {
    const btn = item.querySelector('.faq__q');
    const panel = item.querySelector('.faq__a');
    if ((btn.getAttribute('aria-expanded') === 'true') === open) return;
    btn.setAttribute('aria-expanded', String(open));
    gsap.killTweensOf(panel);
    if (open) {
      panel.hidden = false;
      if (reduced) return;
      gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.7, ease: 'power3.inOut', onComplete: () => ScrollTrigger.refresh() });
      gsap.fromTo(panel.firstElementChild, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.1, ease: 'power3.out' });
    } else {
      if (reduced) { panel.hidden = true; return; }
      gsap.to(panel, { height: 0, duration: 0.55, ease: 'power3.inOut', onComplete: () => { panel.hidden = true; panel.style.height = ''; ScrollTrigger.refresh(); } });
    }
  };
  for (const item of items) {
    item.querySelector('.faq__q').addEventListener('click', () => {
      const open = item.querySelector('.faq__q').getAttribute('aria-expanded') !== 'true';
      for (const other of items) if (other !== item) set(other, false);
      set(item, open);
    });
  }
}
