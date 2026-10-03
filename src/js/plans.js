// Monthly / yearly toggle: prices count to their new value.
import { gsap, reduced } from './motion.js';

export function initPlans() {
  const radios = document.querySelectorAll('[data-billing]');
  if (!radios.length) return;
  const prices = [...document.querySelectorAll('[data-price]')];
  const pers = document.querySelectorAll('[data-per]');
  const apply = (period) => {
    for (const el of prices) {
      const to = Number(el.dataset[period]);
      const from = Number(el.textContent.replace(/\D/g, '')) || to;
      if (reduced) { el.textContent = to.toLocaleString('en-MY'); continue; }
      const o = { v: from };
      gsap.to(o, { v: to, duration: 0.8, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString('en-MY')) });
    }
    pers.forEach((p) => (p.textContent = period === 'year' ? '/ year' : '/ month'));
  };
  radios.forEach((r) => r.addEventListener('change', () => r.checked && apply(r.value)));
}
