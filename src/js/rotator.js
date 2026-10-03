// Word rotator: one word at a time, each leaving upward through a blur. Runs only while its
// section is on screen.
import { gsap, reduced, ScrollTrigger } from './motion.js';

export function initRotators() {
  for (const box of document.querySelectorAll('[data-rotator]')) {
    const words = [...box.children];
    if (words.length < 2 || reduced) continue;
    gsap.set(words, { opacity: 0, yPercent: 60, filter: 'blur(6px)' });
    gsap.set(words[0], { opacity: 1, yPercent: 0, filter: 'blur(0px)' });
    const tl = gsap.timeline({ repeat: -1, paused: true });
    words.forEach((w, i) => {
      const next = words[(i + 1) % words.length];
      tl.to(w, { opacity: 0, yPercent: -60, filter: 'blur(6px)', duration: 0.55, ease: 'power2.in' }, '+=1.8')
        .fromTo(next, { opacity: 0, yPercent: 60, filter: 'blur(6px)' }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }, '-=0.45');
    });
    ScrollTrigger.create({ trigger: box.closest('section') || box, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? tl.play() : tl.pause()) });
  }
}
