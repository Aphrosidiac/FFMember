// Numerals: each row is scrubbed by its distance from the viewport centre — sharp and full size
// at the centre, smaller, softer and dimmer towards the edges.
import { gsap, reduced, lenis } from './motion.js';

export function initNumbers() {
  const list = document.querySelector('[data-numbers]');
  if (!list || reduced) return;
  const rows = [...list.children];
  const nums = rows.map((r) => r.querySelector('.numbers__n'));
  let active = false;
  new IntersectionObserver(([e]) => (active = e.isIntersecting), { rootMargin: '20% 0px' }).observe(list);
  const update = () => {
    if (!active) return;
    const vh = innerHeight;
    rows.forEach((row, i) => {
      const r = row.getBoundingClientRect();
      const c = (r.top + r.height / 2 - vh / 2) / (vh / 2); // -1 top edge … 1 bottom edge
      const d = Math.min(Math.abs(c), 1.4);
      const k = Math.max(0, d - 0.15) / 1.25;
      nums[i].style.transform = `translate3d(${k * -2}%, 0, 0) scale(${1 - k * 0.14})`;
      nums[i].style.opacity = String(1 - k * 0.75);
      nums[i].style.filter = k > 0.02 ? `blur(${(k * 6).toFixed(2)}px)` : 'none';
    });
  };
  nums.forEach((n) => (n.style.transformOrigin = '0% 80%'));
  if (lenis) lenis.on('scroll', update); else addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  gsap.delayedCall(0.1, update);
}
