// Fixed nav: hides on scroll down, returns on scroll up, gains glass capsules past the hero and
// flips to ink over bone sections ([data-nav-theme="light"]). A single pill slides between links.
// Burger opens a full-screen menu with focus kept inside it.
import { lockScroll, scrollTo, lenis } from './motion.js';

export function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let last = 0;
  let update = () => {};
  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 40);
    const open = document.documentElement.classList.contains('menu-open');
    // Only a real move changes it: Lenis emits once more with the same position 400 ms after a
    // native (touch) scroll stops, which used to bring the nav back after every swipe.
    if (!open && y > 200 && y > last + 2) nav.classList.add('is-hidden');
    if (y < last - 2 || y <= 200) nav.classList.remove('is-hidden');
    last = y;
    update();
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
    update();
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

  // Theme and current section, both read from what sits under the nav / the middle of the screen.
  const box = nav.querySelector('.nav__links');
  const hashOf = (l) => new URL(l.href, location.href).hash;
  const links = location.pathname === '/' ? [...nav.querySelectorAll('.nav__link')].filter((l) => hashOf(l)) : [];
  const targets = links.map((l) => document.querySelector(hashOf(l)));
  const light = [...document.querySelectorAll('[data-nav-theme="light"]')];
  const pill = document.createElement('span');
  pill.className = 'nav__pill no-anim';
  pill.setAttribute('aria-hidden', 'true');
  box?.prepend(pill);
  let current = box?.querySelector('.nav__link.is-current') || null;
  let hovering = false;
  const place = (l) => {
    pill.classList.toggle('is-placed', !!l);
    if (!l) return;
    pill.style.width = `${l.offsetWidth}px`;
    pill.style.transform = `translateX(${l.offsetLeft}px)`;
    requestAnimationFrame(() => pill.classList.remove('no-anim'));
  };
  if (box) {
    box.addEventListener('pointerover', (e) => { const l = e.target.closest('.nav__link'); if (l) { hovering = true; place(l); } });
    box.addEventListener('pointerleave', () => { hovering = false; place(current); });
  }
  update = () => {
    const navMid = nav.offsetHeight / 2;
    const onLight = light.some((s) => { const r = s.getBoundingClientRect(); return r.top <= navMid && r.bottom > navMid; });
    nav.classList.toggle('is-light', onLight && !document.documentElement.classList.contains('menu-open'));
    if (!links.length) return;
    const mid = innerHeight / 2;
    let next = null;
    targets.forEach((t, i) => { if (!t) return; const r = t.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) next = links[i]; });
    if (next === current) return;
    links.forEach((l) => l.classList.toggle('is-current', l === next));
    current = next;
    if (!hovering) place(current);
  };
  update();
  place(current);
  addEventListener('resize', () => place(current));
  document.fonts?.ready.then(() => place(current));
}
