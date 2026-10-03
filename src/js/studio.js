// Studio page: work cards lift in as they arrive.
import { gsap, reduced } from './motion.js';

export function initStudio() {
  if (reduced) return;
  for (const card of document.querySelectorAll('[data-works] .work')) {
    gsap.from(card, { opacity: 0, y: 60, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
    const img = card.querySelector('img');
    gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  gsap.from('.principles__list li', { opacity: 0, y: 30, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.principles__list', start: 'top 85%', once: true } });
  gsap.from('.page-hero__foot > *', { opacity: 0, y: 24, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.3 });
}
