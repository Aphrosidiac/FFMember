// Infinite marquees. Each row clones its track until it is twice the viewport, then loops with a
// modulo offset; scroll velocity adds a push in the row's own direction.
import { gsap, reduced, lenis } from './motion.js';

export function initMarquees() {
  const rows = [...document.querySelectorAll('[data-marquee]')];
  if (!rows.length) return;
  const state = rows.map((row) => {
    const track = row.querySelector('.marquee__track');
    const base = [...track.children];
    let guard = 0;
    while (track.scrollWidth < innerWidth * 2.2 && guard++ < 8) {
      for (const n of base) { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); }
    }
    const unit = base.reduce((w, n) => w + n.getBoundingClientRect().width, 0);
    return { row, track, base, unit, dir: Number(row.dataset.marquee) || 1, x: 0, visible: false };
  });
  if (reduced) return;
  const io = new IntersectionObserver((es) => {
    for (const e of es) { const s = state.find((s) => s.row === e.target); if (s) s.visible = e.isIntersecting; }
  });
  state.forEach((s) => io.observe(s.row));
  let boost = 0;
  if (lenis) lenis.on('scroll', (l) => { boost = Math.min(Math.abs(l.velocity) * 0.6, 18); });
  addEventListener('resize', () => {
    for (const s of state) s.unit = s.base.reduce((w, n) => w + n.getBoundingClientRect().width, 0) || s.unit;
  });
  gsap.ticker.add((t, dt) => {
    boost *= 0.92;
    for (const s of state) {
      if (!s.visible) continue;
      s.x -= s.dir * (0.045 * dt + boost * 0.4);
      const u = s.unit;
      const x = ((s.x % u) + u) % u;
      s.track.style.transform = `translate3d(${-x}px,0,0)`;
    }
  });
}
