// Fixed nav: hides on scroll down, returns on scroll up, gains a backing past the hero.
// Burger opens a full-screen menu with focus kept inside it.
import { lockScroll, scrollTo, lenis } from './motion.js';

export function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let last = 0;
  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 40);
    const open = document.documentElement.classList.contains('menu-open');
    if (!open) nav.classList.toggle('is-hidden', y > 200 && y > last + 2);
    if (y < last - 2) nav.classList.remove('is-hidden');
    last = y;
  };
  if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

  const burger = nav.querySelector('[data-burger]');
  const menu = document.querySelector('[data-menu]');
  const setMenu = (open) => {
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.inert = !open;
    lockScroll(open);
    if (open) menu.querySelector('a, button')?.focus({ preventScroll: true });
  };
  if (burger && menu) {
    menu.inert = true;
    burger.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a, [data-join]')) setMenu(false); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
    });
    matchMedia('(min-width: 861px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  // In-page anchors (same page only) go through the smooth scroll.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = url.hash === '#top' ? 0 : document.querySelector(url.hash);
    if (target === null) return;
    e.preventDefault();
    scrollTo(target === 0 ? 0 : target);
    history.replaceState(null, '', url.hash === '#top' ? location.pathname : url.hash);
  });

  // Highlight the section the reader is in.
  const hashOf = (l) => new URL(l.href, location.href).hash;
  const links = location.pathname === '/' ? [...nav.querySelectorAll('.nav__link')].filter((l) => hashOf(l)) : [];
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      for (const l of links) l.classList.toggle('is-current', hashOf(l) === '#' + en.target.id);
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((l) => { const s = document.querySelector(hashOf(l)); if (s) io.observe(s); });
}
