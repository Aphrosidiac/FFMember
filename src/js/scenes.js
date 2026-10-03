// Smaller scroll scenes: plated backgrounds that drift, the oval window that opens to full screen,
// and the visitor's own clock beside the studio's.
import { gsap, ScrollTrigger, reduced } from './motion.js';

export function initParallax() {
  if (reduced) return;
  for (const bg of document.querySelectorAll('[data-parallax]')) {
    const plate = bg.firstElementChild;
    gsap.fromTo(bg, { yPercent: -8 }, { yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (plate) gsap.fromTo(plate, { rotate: -6 }, { rotate: -2, ease: 'none',
      scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

export function initReveal() {
  const section = document.querySelector('[data-reveal]');
  if (!section) return;
  const win = section.querySelector('[data-reveal-window]');
  const grid = win.querySelector('.reveal__plate');
  const mark = section.querySelector('[data-reveal-mark]');
  const title = section.querySelector('[data-reveal-title]');
  if (reduced) { win.style.clipPath = 'none'; grid.style.transform = 'none'; return; }
  const s = { rx: 9, ry: 14 };
  const apply = () => (win.style.clipPath = `ellipse(${s.rx}% ${s.ry}% at 50% 50%)`);
  const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 1 } });
  tl.to(s, { rx: 80, ry: 80, ease: 'power2.inOut', duration: 0.7, onUpdate: apply }, 0.05)
    .to(grid, { scale: 1, ease: 'power2.inOut', duration: 0.7 }, 0.05)
    .to(mark, { scale: 0.6, opacity: 0, ease: 'power2.in', duration: 0.3 }, 0.25)
    .from(title, { opacity: 0, y: 60, ease: 'power3.out', duration: 0.25 }, 0.6)
    .to({}, { duration: 0.1 });
  apply();
}

export function initLocalClock() {
  const els = document.querySelectorAll('[data-clock-local]');
  if (!els.length) return;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { const t = fmt.format(new Date()); els.forEach((e) => (e.textContent = t)); };
  tick();
  setInterval(tick, 1000);
}
