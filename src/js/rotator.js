// Word rotator: one word at a time, each leaving upward through a blur. The words share one grid cell,
// so the box would otherwise always be as wide as the longest word and a short word would sit off
// centre; instead the box takes the width of the word on show and eases between widths. Runs only
// while its section is on screen.
import { gsap, reduced, ScrollTrigger } from './motion.js';

export function initRotators() {
  for (const box of document.querySelectorAll('[data-rotator]')) {
    const words = [...box.children];
    if (!words.length) continue;
    let current = 0;
    const widthOf = (w) => w.getBoundingClientRect().width;
    const fit = () => { box.style.width = `${widthOf(words[current])}px`; };
    // measure once fonts are in; re-measure on resize
    document.fonts.ready.then(fit);
    addEventListener('resize', fit);
    fit();
    if (words.length < 2 || reduced) continue;
    gsap.set(words, { opacity: 0, yPercent: 60, filter: 'blur(6px)' });
    gsap.set(words[0], { opacity: 1, yPercent: 0, filter: 'blur(0px)' });
    const tl = gsap.timeline({ repeat: -1, paused: true });
    words.forEach((w, i) => {
      const n = (i + 1) % words.length;
      const next = words[n];
      tl.to(w, { opacity: 0, yPercent: -60, filter: 'blur(6px)', duration: 0.55, ease: 'power2.in' }, '+=1.8')
        .add(() => { current = n; }, '-=0.2')
        .to(box, { width: () => widthOf(next), duration: 0.7, ease: 'power3.inOut' }, '<')
        .fromTo(next, { opacity: 0, yPercent: 60, filter: 'blur(6px)' }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }, '-=0.45');
    });
    ScrollTrigger.create({ trigger: box.closest('section') || box, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? tl.play() : tl.pause()) });
  }
}
