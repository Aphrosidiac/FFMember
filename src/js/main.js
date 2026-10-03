// Boot order: smooth scroll → chrome (nav, clocks, modals) → intro → WebGL scenes → reveals.
// Every scene is optional: a missing canvas, no WebGL or a failed texture leaves the static page.
import { startScroll, gsap, ScrollTrigger, reduced, scrollTo } from './motion.js';
import { initClocks } from './clock.js';
import { initNav } from './nav.js';
import { initModals } from './modal.js';
import { playIntro } from './intro.js';
import { initReveals } from './reveal.js';
import { initAccordion } from './accordion.js';
import { initMarquees } from './marquee.js';
import { initPlans } from './plans.js';
import { initFigures } from './figures.js';
import { initParallax, initReveal, initLocalClock } from './scenes.js';
import { initProcess } from './process.js';
import { initRotators } from './rotator.js';
import { webglAvailable } from './gl/support.js';

const page = document.body.dataset.page;
startScroll();
initClocks();
initNav();
initModals();
initAccordion();

async function heroIn(hero) {
  const title = document.querySelector('[data-hero-title]');
  const ins = document.querySelectorAll('[data-hero-in]');
  if (reduced || !title) { hero?.playEnter?.(); return; }
  await document.fonts.ready;
  // The text entrance is CSS (see .hero-pre in home.css): the compositor runs it by the clock, so it
  // lands on time even while a slow GPU keeps the main thread busy building the 3D scene.
  const root = document.documentElement;
  root.classList.add('hero-pre');
  return () => {
    hero?.playEnter?.();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('hero-entering');
      root.classList.remove('hero-pre');
      setTimeout(() => root.classList.remove('hero-entering'), 2400);
    }));
  };
}

async function bootHome() {
  const gl = webglAvailable();
  let hero = null;
  const heroCanvas = document.querySelector('[data-hero-gl]');
  const heroReady = gl && heroCanvas
    ? import('./gl/hero.js').then((m) => m.initHero(heroCanvas)).then((h) => (hero = h)).catch((e) => console.warn('[hero]', e))
    : Promise.resolve();
  const reveal = await heroIn(null);
  const introDone = playIntro();
  await Promise.race([heroReady, new Promise((r) => setTimeout(r, 2500))]);
  await introDone;
  // The text enters now; the 3D scene enters whenever it is ready (it can take longer on a slow GPU).
  if (typeof reveal === 'function') reveal();
  heroReady.then(() => hero?.playEnter?.());

  initRotators();
  initMarquees();
  initPlans();
  initFigures();
  initParallax();
  initReveal();
  initLocalClock();
  initProcess();
  initReveals();

  if (gl) {
    const globeCanvas = document.querySelector('[data-globe-gl]');
    if (globeCanvas) {
      import('./gl/globe.js').then((m) => m.initGlobe(globeCanvas, {
        section: document.querySelector('.globe'),
        pin: document.querySelector('[data-globe-pin]'),
        chips: document.querySelector('[data-globe-chips]'),
        copyA: document.querySelector('[data-globe-a]'),
        copyB: document.querySelector('[data-globe-b]'),
      })).catch((e) => console.warn('[globe]', e));
    }
    const tubeCanvas = document.querySelector('[data-tube-gl]');
    if (tubeCanvas) {
      import('./gl/tube.js').then((m) => m.initTube(tubeCanvas, {
        section: document.querySelector('.tube'),
        copy: document.querySelector('[data-tube-copy]'),
      })).catch((e) => console.warn('[tube]', e));
    }
  }
  addEventListener('load', () => ScrollTrigger.refresh());
}

async function bootPage() {
  initReveals();
  if (page === 'studio') {
    const { initStudio } = await import('./studio.js');
    initStudio();
  }
}

if (page === 'home') bootHome();
else bootPage();

// Arriving with a hash (e.g. /#plans from another page): jump once layout has settled.
if (location.hash && page === 'home') {
  addEventListener('load', () => setTimeout(() => {
    const el = document.querySelector(location.hash);
    if (el) scrollTo(el, { immediate: true });
  }, 300));
}
