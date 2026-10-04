// Two columns of plan figures stream upward past a pinned centre. Each figure bows outward along
// an arc as it nears the middle of the screen and fades and softens towards the edges.
import { gsap, reduced, lenis } from './motion.js';

const LEFT = ['RM59', 'RM590', '60 min', 'RM149', '30 days', 'RM1,490', '3 h', 'RM299', 'RM2,990', '10×'];
const RIGHT = ['RM2,990', '3 h', 'RM299', '30 days', 'RM149', '10×', 'RM1,490', '60 min', 'RM59', 'RM590'];

export function initFigures() {
  const section = document.querySelector('[data-figures]');
  if (!section) return;
  const arcs = [...section.querySelectorAll('[data-arc]')];
  const items = [];
  const ROWS = 30;
  for (const arc of arcs) {
    const words = arc.dataset.arc === 'left' ? LEFT : RIGHT;
    for (let i = 0; i < ROWS; i++) {
      const el = document.createElement('span');
      el.className = 'figure';
      el.textContent = words[i % words.length];
      arc.appendChild(el);
      items.push({ el, i, side: arc.dataset.arc === 'left' ? -1 : 1 });
    }
  }
  const update = () => {
    const r = section.getBoundingClientRect();
    const vh = innerHeight;
    const gap = Math.max(48, vh * 0.075);
    for (const it of items) {
      // document position of the row inside the section, plus a stagger between the two sides
      const y = it.i * gap + (it.side > 0 ? gap / 2 : 0) + vh * 0.35;
      const screenY = r.top + y;
      const c = (screenY - vh / 2) / (vh / 2); // -1 top … 1 bottom
      const d = Math.min(Math.abs(c), 1.6);
      const bow = Math.cos(Math.min(d, 1) * Math.PI / 2); // 1 at centre, 0 at edges
      const x = it.side * bow * Math.min(innerWidth * (innerWidth < 700 ? 0.05 : 0.07), 96);
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(0.82 + bow * 0.28).toFixed(3)})`;
      it.el.style.opacity = String(Math.max(0, 1 - d * 0.75).toFixed(3));
      it.el.style.filter = d > 0.35 && !reduced ? `blur(${((d - 0.35) * 5).toFixed(2)}px)` : 'none';
      it.el.style.color = bow > 0.92 ? 'var(--ink)' : '';
    }
  };
  if (lenis) lenis.on('scroll', update); else addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  gsap.delayedCall(0.05, update);
  update();
}
